import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createWant } from "@/app/api/wants/route";
import { DELETE as deleteWant } from "@/app/api/wants/[id]/route";
import { POST as addSeller } from "@/app/api/wants/[id]/sellers/route";
import { POST as addListings } from "@/app/api/wants/[id]/listings/route";
import { GET as getCategories } from "@/app/api/marketplace/categories/route";
import { POST as marketSearch } from "@/app/api/marketplace/search/route";
import { POST as buyNow } from "@/app/api/wants/[id]/buy/route";
import { POST as approveRoute } from "@/app/api/threads/[id]/approve/route";
import { GET as transcript } from "@/app/api/threads/[id]/transcript/route";
import { POST as declineRoute } from "@/app/api/threads/[id]/decline/route";
import { POST as demoPayRoute } from "@/app/api/deals/[id]/demo-pay/route";
import { POST as negotiate } from "@/app/api/wants/[id]/negotiate/route";
import { POST as loadDemo } from "@/app/api/demo/route";
import { GET as getState } from "@/app/api/state/route";
import { POST as pause } from "@/app/api/threads/[id]/pause/route";
import { POST as resume } from "@/app/api/threads/[id]/resume/route";
import { POST as createOrder } from "@/app/api/deals/[id]/order/route";
import { POST as refund } from "@/app/api/deals/[id]/refund/route";
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
    expect(s.config).toEqual({ paypalClientId: null, paypalBuyerEmail: null, llmMode: "template", listings: false });
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
  it("refund route maps errors: unknown deal 404, unpaid deal 409", async () => {
    expect((await refund(post("/api/deals/nope/refund"), ctx({ id: "nope" }))).status).toBe(404);
    const { wantId } = await (await loadDemo(post("/api/demo"))).json();
    await negotiate(post(`/api/wants/${wantId}/negotiate`), ctx({ id: wantId }));
    await svc.runner.idle();
    const deal = (await state()).deals[0]!;
    expect((await refund(post(`/api/deals/${deal.id}/refund`), ctx({ id: deal.id }))).status).toBe(409);
  });

  describe("real listings", () => {
    const wantBody = { item: "Headphones", maxPrice: 250, notes: "", buyerName: "Alex" };
    const L = (retailer: string, price: number) => ({ title: "Sony WH", retailer, price, condition: "new", url: `https://${retailer}/p`, image: null });

    it("explains how to enable it when there is no Channel3 key", async () => {
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      const res = await addListings(post(`/api/wants/${w.id}/listings`), ctx({ id: w.id }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("CHANNEL3_API_KEY");
    });

    it("adds real retailers near the budget as sellers, skipping far-off prices and repeats", async () => {
      svc.findListings = async () => ({ listings: [L("bestbuy.com", 240), L("luxury.com", 900), L("target.com", 199), L("bestbuy.com", 210)], next: null });
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      const res = await addListings(post(`/api/wants/${w.id}/listings`), ctx({ id: w.id }));
      expect(res.status).toBe(201);
      expect((await res.json()).map((s: { name: string }) => s.name)).toEqual(["bestbuy.com", "target.com"]);
      expect((await state()).wants[0]!.sellers).toHaveLength(2);
    });

    it("says so when nothing is near the budget", async () => {
      svc.findListings = async () => ({ listings: [L("luxury.com", 900)], next: null });
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      expect((await addListings(post(`/api/wants/${w.id}/listings`), ctx({ id: w.id }))).status).toBe(409);
    });
  });

  describe("marketplace", () => {
    const wantBody = { item: "Headphones", maxPrice: 250, notes: "", buyerName: "Alex" };
    const L = { title: "Sony WH", retailer: "bestbuy.com", price: 240, condition: "new", url: "https://bestbuy.com/p", image: "https://cdn.trychannel3.com/i.png" };

    it("needs a Channel3 key for categories and search", async () => {
      expect((await getCategories(new Request(url("/api/marketplace/categories")))).status).toBe(400);
      expect((await marketSearch(post("/api/marketplace/search", { query: "x" }))).status).toBe(400);
    });

    it("lists categories and searches by text and category", async () => {
      svc.categories = async () => [{ slug: "electronics", title: "Electronics" }];
      const seen: unknown[] = [];
      svc.findListings = async (q, o) => (seen.push([q, o?.category]), { listings: [L], next: "tok" });
      expect(await (await getCategories(new Request(url("/api/marketplace/categories")))).json()).toEqual([{ slug: "electronics", title: "Electronics" }]);
      expect((await (await marketSearch(post("/api/marketplace/search", { query: "tv", category: "electronics" }))).json())).toEqual({ listings: [L], next: "tok" });
      await marketSearch(post("/api/marketplace/search", { category: "Not A Slug!" }).clone());
      expect(seen[0]).toEqual(["tv", "electronics"]);
    });

    it("asks for a search or a category", async () => {
      svc.findListings = async () => ({ listings: [], next: null });
      expect((await marketSearch(post("/api/marketplace/search", {}))).status).toBe(400);
    });

    it("adds the one picked listing as a seller, and rejects an invalid one", async () => {
      svc.findListings = async () => ({ listings: [], next: null });
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      const ok = await addListings(post(`/api/wants/${w.id}/listings`, { listing: L }), ctx({ id: w.id }));
      expect(ok.status).toBe(201);
      expect((await ok.json()).map((s: { name: string }) => s.name)).toEqual(["bestbuy.com"]);
      const bad = await addListings(post(`/api/wants/${w.id}/listings`, { listing: { ...L, url: "javascript:alert(1)" } }), ctx({ id: w.id }));
      expect(bad.status).toBe(400);
      expect((await state()).wants[0]!.sellers).toHaveLength(1);
    });

    it("passes the condition filter through to the search", async () => {
      const seen: unknown[] = [];
      svc.findListings = async (q, o) => (seen.push([q, o?.category, o?.condition]), { listings: [], next: null });
      await marketSearch(post("/api/marketplace/search", { query: "tv", condition: "used" }));
      await marketSearch(post("/api/marketplace/search", { query: "tv", condition: "bogus" }));
      expect(seen).toEqual([["tv", undefined, "used"], ["tv", undefined, undefined]]);
    });

    it("passes a price range and a page token through, and ignores or rejects bad ones", async () => {
      const seen: Record<string, unknown>[] = [];
      svc.findListings = async (_q, o) => (seen.push({ ...o }), { listings: [], next: null });
      await marketSearch(post("/api/marketplace/search", { query: "tv", minPrice: 50, maxPrice: 300, pageToken: "abc" }));
      await marketSearch(post("/api/marketplace/search", { query: "tv", minPrice: -5, maxPrice: "x", pageToken: 7 }));
      expect(seen[0]).toMatchObject({ minPrice: 50, maxPrice: 300, pageToken: "abc" });
      expect(seen[1]).toMatchObject({ minPrice: undefined, maxPrice: undefined, pageToken: undefined });
      expect((await marketSearch(post("/api/marketplace/search", { query: "tv", minPrice: 300, maxPrice: 50 }))).status).toBe(400);
    });

    describe("buy at the listed price", () => {
      it("creates a deal at the listed price, with no haggling, ready to pay", async () => {
        const w = await (await createWant(post("/api/wants", wantBody))).json();
        const res = await buyNow(post(`/api/wants/${w.id}/buy`, { listing: L }), ctx({ id: w.id }));
        expect(res.status).toBe(201);
        const s = await state();
        expect(s.deals).toHaveLength(1);
        expect(s.deals[0]).toMatchObject({ price: 240, status: "awaiting_payment", sellerName: "bestbuy.com" });
        const t = s.threads[0]!;
        expect(t).toMatchObject({ status: "deal", dealPrice: 240 });
        expect(t.messages.at(-1)!.guard).toContain("within your $250 budget");
      });

      it("refuses a price above the budget, so the ceiling holds without haggling too", async () => {
        const w = await (await createWant(post("/api/wants", wantBody))).json();
        const res = await buyNow(post(`/api/wants/${w.id}/buy`, { listing: { ...L, price: 251 } }), ctx({ id: w.id }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain("above your $250 budget");
        expect((await state()).deals).toHaveLength(0);
      });

      it("refuses the same product twice, and an invalid listing", async () => {
        const w = await (await createWant(post("/api/wants", wantBody))).json();
        expect((await buyNow(post(`/api/wants/${w.id}/buy`, { listing: L }), ctx({ id: w.id }))).status).toBe(201);
        expect((await buyNow(post(`/api/wants/${w.id}/buy`, { listing: L }), ctx({ id: w.id }))).status).toBe(409);
        expect((await buyNow(post(`/api/wants/${w.id}/buy`, { listing: { ...L, url: "javascript:1" } }), ctx({ id: w.id }))).status).toBe(400);
        expect((await state()).deals).toHaveLength(1);
      });

      it("answers 404 for an unknown want", async () => {
        expect((await buyNow(post("/api/wants/nope/buy", { listing: L }), ctx({ id: "nope" }))).status).toBe(404);
      });
    });
  });

  describe("demo mode (?demo=1)", () => {
    const demoNegotiate = (wantId: string) => negotiate(post(`/api/wants/${wantId}/negotiate?demo=1`), ctx({ id: wantId }));
    const demoPay = (dealId: string) => demoPayRoute(post(`/api/deals/${dealId}/demo-pay`), ctx({ id: dealId }));

    async function closedDeal() {
      const demo = await (await loadDemo(post("/api/demo"))).json();
      await demoNegotiate(demo.wantId);
      await svc.runner.idle();
      return (await state()).deals.find((d) => d.wantId === demo.wantId)!;
    }

    it("runs the negotiation to the end with canned text and no delay", async () => {
      const demo = await (await loadDemo(post("/api/demo"))).json();
      expect((await demoNegotiate(demo.wantId)).status).toBe(202);
      await svc.runner.idle();
      const s = await state();
      expect(s.threads.every((t) => t.status !== "negotiating")).toBe(true);
      expect(s.deals.length).toBeGreaterThan(0);
    });

    it("pays with DEMO-labelled ids, never calls PayPal, buys the want and withdraws from the others", async () => {
      const deal = await closedDeal();
      expect(svc.publicConfig.paypalClientId).toBeNull(); // no PayPal configured: the real flow could not have run
      const res = await demoPay(deal.id);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "paid", payerId: "DEMO-PAYER", captureId: `DEMO-CAPTURE-${deal.id}` });
      const s = await state();
      expect(s.wants.find((w) => w.id === deal.wantId)!.status).toBe("purchased");
      const paidThread = s.threads.find((t) => t.id === deal.threadId)!;
      expect(paidThread.messages.at(-1)!.text).toContain("DEMO MODE");
      expect(s.threads.filter((t) => t.id !== deal.threadId).every((t) => t.status === "walked_away" || t.status === "deal")).toBe(true);
    });

    it("can refund a demo payment without PayPal, and says it was a demo", async () => {
      const deal = await closedDeal();
      await demoPay(deal.id);
      const res = await refund(post(`/api/deals/${deal.id}/refund`), ctx({ id: deal.id }));
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("refunded");
      const t = (await state()).threads.find((x) => x.id === deal.threadId)!;
      expect(t.messages.at(-1)!.text).toContain("DEMO MODE");
    });

    it("is idempotent, and refuses unknown or cancelled deals", async () => {
      const deal = await closedDeal();
      expect((await demoPay(deal.id)).status).toBe(200);
      expect((await demoPay(deal.id)).status).toBe(200);
      expect((await demoPay("nope")).status).toBe(404);
      const cancelled = (await state()).deals.find((d) => d.status === "cancelled");
      if (cancelled) expect((await demoPay(cancelled.id)).status).toBe(409);
    });
  });

  describe("approve before accepting (API)", () => {
    const wantBody = { item: "Headphones", maxPrice: 250, notes: "", buyerName: "Alex", requireApproval: true };

    async function holding() {
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      await addSeller(post(`/api/wants/${w.id}/sellers`, { persona: "ferdi" }), ctx({ id: w.id }));
      await negotiate(post(`/api/wants/${w.id}/negotiate`), ctx({ id: w.id }));
      await svc.runner.idle();
      const s = await state();
      return { wantId: w.id as string, thread: s.threads.find((x) => x.wantId === w.id)! };
    }

    it("holds the price instead of closing, and creates no deal yet", async () => {
      const { thread } = await holding();
      expect(thread.status).toBe("awaiting_approval");
      expect((await state()).deals).toHaveLength(0);
    });

    it("approving creates the deal at the held price; approving twice is refused", async () => {
      const { thread } = await holding();
      const res = await approveRoute(post(`/api/threads/${thread.id}/approve`), ctx({ id: thread.id }));
      expect(res.status).toBe(200);
      const s = await state();
      expect(s.deals).toHaveLength(1);
      expect(s.deals[0]!.price).toBe(thread.lastAsk);
      expect((await approveRoute(post(`/api/threads/${thread.id}/approve`), ctx({ id: thread.id }))).status).toBe(409);
    });

    it("declining ends the thread with no deal", async () => {
      const { thread } = await holding();
      expect((await declineRoute(post(`/api/threads/${thread.id}/decline`), ctx({ id: thread.id }))).status).toBe(200);
      const s = await state();
      expect(s.deals).toHaveLength(0);
      expect(s.threads.find((x) => x.id === thread.id)).toMatchObject({ status: "walked_away", reason: "declined_by_user" });
    });

    it("answers 404 for an unknown thread", async () => {
      expect((await approveRoute(post("/api/threads/nope/approve"), ctx({ id: "nope" }))).status).toBe(404);
    });
  });

  describe("transcript download", () => {
    it("serves a negotiation as a Markdown attachment, and 404s for an unknown thread", async () => {
      const demo = await (await loadDemo(post("/api/demo"))).json();
      await negotiate(post(`/api/wants/${demo.wantId}/negotiate`), ctx({ id: demo.wantId }));
      await svc.runner.idle();
      const t = (await state()).threads[0]!;
      const res = await transcript(new Request(url(`/api/threads/${t.id}/transcript`)), ctx({ id: t.id }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");
      expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="hagglebot-[a-z-]+\.md"$/);
      expect(await res.text()).toContain("## Conversation");
      expect((await transcript(new Request(url("/api/threads/nope/transcript")), ctx({ id: "nope" }))).status).toBe(404);
    });
  });

  describe("sellers added after a purchase or a run", () => {
    const wantBody = { item: "Headphones", maxPrice: 250, notes: "", buyerName: "Alex" };
    const L = { title: "Sony WH", retailer: "bestbuy.com", price: 240, condition: "new", url: "https://bestbuy.com/p", image: null };

    it("negotiates only the new sellers, and keeps a direct purchase and its deal", async () => {
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      await buyNow(post(`/api/wants/${w.id}/buy`, { listing: L }), ctx({ id: w.id }));
      expect((await addSeller(post(`/api/wants/${w.id}/sellers`, { persona: "ferdi" }), ctx({ id: w.id }))).status).toBe(201);
      expect((await negotiate(post(`/api/wants/${w.id}/negotiate`), ctx({ id: w.id }))).status).toBe(202);
      await svc.runner.idle();
      const s = await state();
      expect(s.threads).toHaveLength(2);
      expect(s.threads.find((x) => x.sellerName === "bestbuy.com")).toMatchObject({ status: "deal", dealPrice: 240 });
      expect(s.deals.find((d) => d.sellerName === "bestbuy.com")).toMatchObject({ status: "awaiting_payment", price: 240 });
      expect(s.threads.find((x) => x.sellerName === "Fast Ferdi")!.status).not.toBe("negotiating");
    });

    it("still refuses to run again when every seller already has a conversation", async () => {
      const w = await (await createWant(post("/api/wants", wantBody))).json();
      await addSeller(post(`/api/wants/${w.id}/sellers`, { persona: "ferdi" }), ctx({ id: w.id }));
      await negotiate(post(`/api/wants/${w.id}/negotiate`), ctx({ id: w.id }));
      await svc.runner.idle();
      expect((await negotiate(post(`/api/wants/${w.id}/negotiate`), ctx({ id: w.id }))).status).toBe(409);
    });
  });
});
