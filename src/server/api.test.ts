import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createWant } from "@/app/api/wants/route";
import { DELETE as deleteWant } from "@/app/api/wants/[id]/route";
import { POST as addSeller } from "@/app/api/wants/[id]/sellers/route";
import { POST as negotiate } from "@/app/api/wants/[id]/negotiate/route";
import { POST as loadDemo } from "@/app/api/demo/route";
import { GET as getState } from "@/app/api/state/route";
import { POST as pause } from "@/app/api/threads/[id]/pause/route";
import { POST as resume } from "@/app/api/threads/[id]/resume/route";
import { POST as createOrder } from "@/app/api/deals/[id]/order/route";
import { POST as capture } from "@/app/api/orders/[orderId]/capture/route";
import { PERSONAS } from "@/lib/sellers/personas";
import { PersonaSeller } from "@/lib/sellers/sellerAgent";
import { NegotiationRunner } from "./runner";
import { buildServices, setServicesForTest, type Services } from "./services";
import type { DashboardState } from "./state";

let svc: Services;
beforeEach(() => {
  svc = buildServices({ HAGGLEBOT_DB: ":memory:", HAGGLEBOT_STEP_DELAY_MS: "0" }); // no keys: template mode, PayPal off
  setServicesForTest(svc);
});
afterEach(() => setServicesForTest(undefined));

const url = (p: string) => `http://localhost:3000${p}`;
const post = (p: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url(p), {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const state = async (): Promise<DashboardState> => (await getState(new Request(url("/api/state")))).json();

describe("API", () => {
  it("full demo flow: load, negotiate, observe results", async () => {
    const demo = await loadDemo(post("/api/demo"));
    expect(demo.status).toBe(201);
    const { wantId, created } = await demo.json();
    expect(created).toBe(true);
    expect((await (await loadDemo(post("/api/demo"))).json()).created).toBe(false); // idempotent

    const started = await negotiate(post(`/api/wants/${wantId}/negotiate`), ctx({ id: wantId }));
    expect(started.status).toBe(202);
    await svc.runner.idle();

    const s = await state();
    expect(s.config).toEqual({ paypalClientId: null, paypalBuyerEmail: null, llmMode: "template" });
    expect(s.wants[0]!.sellers).toHaveLength(4);
    expect(s.threads.map((t) => [t.sellerName, t.status]).sort()).toEqual([
      ["Chatty Chen", "deal"], ["Fast Ferdi", "deal"], ["Firm Fatima", "walked_away"], ["Shady Sam", "walked_away"],
    ]);
    expect(s.deals).toHaveLength(2);

    expect((await negotiate(post(`/api/wants/${wantId}/negotiate`), ctx({ id: wantId }))).status).toBe(409);
    const again = await negotiate(post(`/api/wants/${wantId}/negotiate?restart=1`), ctx({ id: wantId }));
    expect(again.status).toBe(202);
    await svc.runner.idle();
    expect((await state()).threads).toHaveLength(4);
  });

  it("creates wants and sellers with validation errors as 400", async () => {
    const bad = await createWant(post("/api/wants", { item: "", maxPrice: 5, buyerName: "A" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/Item name/);
    const res = await createWant(post("/api/wants", { item: "Lamp", maxPrice: 40, notes: "", buyerName: "Alex" }));
    expect(res.status).toBe(201);
    const want = await res.json();
    expect((await addSeller(post(`/api/wants/${want.id}/sellers`, { persona: "x" }), ctx({ id: want.id }))).status).toBe(400);
    expect((await addSeller(post(`/api/wants/${want.id}/sellers`, { persona: "ferdi" }), ctx({ id: want.id }))).status).toBe(201);
    expect((await addSeller(post(`/api/wants/nope/sellers`, { persona: "ferdi" }), ctx({ id: "nope" }))).status).toBe(404);
  });

  it("rejects wrong content type, bad JSON, and cross-origin requests", async () => {
    const wrongType = new Request(url("/api/wants"), { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    expect((await createWant(wrongType)).status).toBe(400);
    const badJson = new Request(url("/api/wants"), { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect((await createWant(badJson)).status).toBe(400);
    const evil = post("/api/demo", undefined, { origin: "https://evil.example" });
    expect((await loadDemo(evil)).status).toBe(403);
    expect((await state()).wants).toHaveLength(0);
  });

  it("pause/resume endpoints stop a live negotiation, enforce state and 404 unknown threads", async () => {
    // A gated seller keeps the negotiation genuinely in flight until we release it.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const runner = new NegotiationRunner({
      repo: svc.repo,
      llm: null,
      sellerFor: (c, ask) => {
        const inner = new PersonaSeller(PERSONAS.find((p) => p.id === c.persona)!, null, ask);
        return { id: inner.id, name: inner.name, respond: async (x) => (await gate, inner.respond(x)) };
      },
    });
    setServicesForTest({ ...svc, runner });

    const { wantId } = await (await loadDemo(post("/api/demo"))).json();
    const { threads } = await (await negotiate(post(`/api/wants/${wantId}/negotiate`), ctx({ id: wantId }))).json();
    const id = threads[0] as string; // Fast Ferdi

    expect((await pause(post("/x"), ctx({ id }))).status).toBe(200);
    expect((await state()).threads.find((t) => t.id === id)!.status).toBe("paused"); // instant feedback
    expect((await pause(post("/x"), ctx({ id }))).status).toBe(409);
    release();
    await runner.idle();
    const frozen = (await state()).threads.find((t) => t.id === id)!;
    expect(frozen.status).toBe("paused");
    expect(frozen.messages.length).toBeLessThanOrEqual(2); // stopped after the in-flight round

    expect((await resume(post("/x"), ctx({ id }))).status).toBe(200);
    await runner.idle();
    expect((await state()).threads.find((t) => t.id === id)).toMatchObject({ status: "deal", dealPrice: 205 });
    expect((await pause(post("/x"), ctx({ id: "ghost" }))).status).toBe(404);
  });

  it("payments return 503 (not a crash) when PayPal is not configured", async () => {
    const { wantId } = await (await loadDemo(post("/api/demo"))).json();
    await negotiate(post(`/api/wants/${wantId}/negotiate`), ctx({ id: wantId }));
    await svc.runner.idle();
    const deal = (await state()).deals[0]!;
    const res = await createOrder(post("/x"), ctx({ id: deal.id }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/PAYPAL_CLIENT_ID/);
    expect((await capture(post("/x"), ctx({ orderId: "ORD" }))).status).toBe(503);
  });

  it("deleting a want removes its threads and deals", async () => {
    const { wantId } = await (await loadDemo(post("/api/demo"))).json();
    await negotiate(post(`/api/wants/${wantId}/negotiate`), ctx({ id: wantId }));
    await svc.runner.idle();
    const del = new Request(url(`/api/wants/${wantId}`), { method: "DELETE", headers: { host: "localhost:3000" } });
    expect((await deleteWant(del, ctx({ id: wantId }))).status).toBe(200);
    const s = await state();
    expect([s.wants.length, s.threads.length, s.deals.length]).toEqual([0, 0, 0]);
    expect((await deleteWant(del, ctx({ id: wantId }))).status).toBe(404);
  });
});
