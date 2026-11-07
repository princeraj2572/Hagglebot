import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createBundle } from "@/app/api/bundles/route";
import { DELETE as deleteBundle } from "@/app/api/bundles/[id]/route";
import { POST as setBundle } from "@/app/api/wants/[id]/bundle/route";
import { POST as createWant } from "@/app/api/wants/route";
import { POST as addSeller } from "@/app/api/wants/[id]/sellers/route";
import { POST as negotiate } from "@/app/api/wants/[id]/negotiate/route";
import { POST as buyNow } from "@/app/api/wants/[id]/buy/route";
import { POST as demoPay } from "@/app/api/deals/[id]/demo-pay/route";
import { POST as createOrder } from "@/app/api/deals/[id]/order/route";
import { GET as getState } from "@/app/api/state/route";
import { buildServices, setServicesForTest, type Services } from "./services";
import type { DashboardState } from "./state";
import { ValidationError, parseBundleInput } from "./validate";

let svc: Services;
beforeEach(() => {
  svc = buildServices({ HAGGLEBOT_DB: ":memory:", HAGGLEBOT_STEP_DELAY_MS: "0" });
  setServicesForTest(svc);
});
afterEach(() => setServicesForTest(undefined));

const post = (p: string, body?: unknown) =>
  new Request(`http://localhost:3000${p}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const state = async (): Promise<DashboardState> => (await getState(new Request("http://localhost:3000/api/state"))).json();

const L = (price: number, retailer = "bestbuy.com") => ({ title: "Sony WH", retailer, price, condition: "new", url: `https://${retailer}/p${price}`, image: null });

async function setup(total = 300) {
  const bundle = await (await createBundle(post("/api/bundles", { name: "Home office", total }))).json();
  const mk = async (item: string, maxPrice: number) => {
    const w = await (await createWant(post("/api/wants", { item, maxPrice, notes: "", buyerName: "Alex" }))).json();
    await setBundle(post(`/api/wants/${w.id}/bundle`, { bundleId: bundle.id }), ctx({ id: w.id }));
    return w.id as string;
  };
  return { bundle, a: await mk("Headphones", 250), b: await mk("Keyboard", 250) };
}

describe("budget bundle", () => {
  it("validates a bundle", () => {
    expect(parseBundleInput({ name: " Setup ", total: 300 })).toEqual({ name: "Setup", total: 300 });
    for (const bad of [{ name: "", total: 300 }, { name: "x", total: 0 }, { name: "x", total: 9.5 }, { name: "x", total: "abc" }, { name: "x".repeat(61), total: 5 }]) {
      expect(() => parseBundleInput(bad)).toThrow(ValidationError);
    }
  });

  it("reports what is spent and what is left, counting only payments that were made", async () => {
    const { bundle, a, b } = await setup(300);
    expect(svc.repo.bundleRoom(a)).toBe(300);
    await buyNow(post(`/api/wants/${a}/buy`, { listing: L(120) }), ctx({ id: a }));
    expect(svc.repo.bundleRoom(b)).toBe(300); // a deal waiting for payment spends nothing yet
    const dealA = (await state()).deals[0]!;
    await demoPay(post(`/api/deals/${dealA.id}/demo-pay`), ctx({ id: dealA.id }));
    expect(svc.repo.bundleRoom(b)).toBe(180);
    expect(svc.repo.getBundle(bundle.id)).toMatchObject({ total: 300, spent: 120 });
    expect(svc.repo.bundleRoom(a)).toBe(300); // a want's own payment is not held against itself
  });

  it("limits a want's budget to what is left in the bundle, when buying at the listed price", async () => {
    const { a, b } = await setup(300);
    await buyNow(post(`/api/wants/${a}/buy`, { listing: L(200) }), ctx({ id: a }));
    const dealA = (await state()).deals[0]!;
    await demoPay(post(`/api/deals/${dealA.id}/demo-pay`), ctx({ id: dealA.id }));
    const over = await buyNow(post(`/api/wants/${b}/buy`, { listing: L(150, "target.com") }), ctx({ id: b }));
    expect(over.status).toBe(400);
    expect((await over.json()).error).toContain("$100 left in your bundle");
    expect((await buyNow(post(`/api/wants/${b}/buy`, { listing: L(90, "target.com") }), ctx({ id: b }))).status).toBe(201);
  });

  it("never lets Hagglebot agree to more than is left in the bundle", async () => {
    const { a, b } = await setup(300);
    await buyNow(post(`/api/wants/${a}/buy`, { listing: L(200) }), ctx({ id: a }));
    const dealA = (await state()).deals[0]!;
    await demoPay(post(`/api/deals/${dealA.id}/demo-pay`), ctx({ id: dealA.id }));
    // Keyboard's own budget is $250, but only $100 is left in the bundle.
    await addSeller(post(`/api/wants/${b}/sellers`, { persona: "ferdi" }), ctx({ id: b }));
    await negotiate(post(`/api/wants/${b}/negotiate`), ctx({ id: b }));
    await svc.runner.idle();
    const s = await state();
    for (const t of s.threads.filter((x) => x.wantId === b)) {
      expect(t.dealPrice === null || t.dealPrice <= 100).toBe(true);
      for (const m of t.messages.filter((x) => x.from === "buyer" && x.price !== null)) expect(m.price!).toBeLessThanOrEqual(100);
    }
  });

  it("refuses to pay anything that would take the bundle over its total, even if two wants both closed", async () => {
    const { a, b } = await setup(300);
    await buyNow(post(`/api/wants/${a}/buy`, { listing: L(200) }), ctx({ id: a }));
    await buyNow(post(`/api/wants/${b}/buy`, { listing: L(180, "target.com") }), ctx({ id: b })); // both fit alone
    const [dealA, dealB] = (await state()).deals;
    expect((await demoPay(post(`/api/deals/${dealA!.id}/demo-pay`), ctx({ id: dealA!.id }))).status).toBe(200);
    const res = await demoPay(post(`/api/deals/${dealB!.id}/demo-pay`), ctx({ id: dealB!.id }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("over its budget");
    // The real PayPal path has the same guard (it fails on the bundle before it needs PayPal at all).
    expect((await createOrder(post(`/api/deals/${dealB!.id}/order`), ctx({ id: dealB!.id }))).status).toBe(503);
    expect((await state()).deals.find((d) => d.id === dealB!.id)!.status).not.toBe("paid");
  });

  it("refuses to start a want whose bundle is used up", async () => {
    const { a, b } = await setup(100);
    await buyNow(post(`/api/wants/${a}/buy`, { listing: L(100) }), ctx({ id: a }));
    const dealA = (await state()).deals[0]!;
    await demoPay(post(`/api/deals/${dealA.id}/demo-pay`), ctx({ id: dealA.id }));
    await addSeller(post(`/api/wants/${b}/sellers`, { persona: "ferdi" }), ctx({ id: b }));
    const res = await negotiate(post(`/api/wants/${b}/negotiate`), ctx({ id: b }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("used up");
  });

  it("deleting a bundle keeps its wants, each with its own budget again", async () => {
    const { bundle, a } = await setup(300);
    expect((await deleteBundle(new Request("http://localhost:3000/x", { method: "DELETE", headers: { host: "localhost:3000" } }), ctx({ id: bundle.id }))).status).toBe(200);
    const s = await state();
    expect(s.bundles).toEqual([]);
    expect(s.wants.find((w) => w.id === a)).toMatchObject({ maxPrice: 250, bundleId: null });
    expect(svc.repo.bundleRoom(a)).toBeNull();
  });

  it("takes a want out of a bundle, and 404s for an unknown want or bundle", async () => {
    const { a } = await setup(300);
    expect((await setBundle(post(`/api/wants/${a}/bundle`, { bundleId: null }), ctx({ id: a }))).status).toBe(200);
    expect((await state()).wants.find((w) => w.id === a)!.bundleId).toBeNull();
    expect((await setBundle(post(`/api/wants/${a}/bundle`, { bundleId: "nope" }), ctx({ id: a }))).status).toBe(404);
    expect((await setBundle(post("/api/wants/nope/bundle", { bundleId: null }), ctx({ id: "nope" }))).status).toBe(404);
  });
});
