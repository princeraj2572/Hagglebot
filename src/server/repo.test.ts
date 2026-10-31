import { beforeEach, describe, expect, it } from "vitest";
import { createThread } from "../lib/negotiation/engine";
import { openDb } from "./db";
import { Repo } from "./repo";

let repo: Repo;
beforeEach(() => {
  repo = new Repo(openDb(":memory:"));
});

const wantInput = { item: "Headphones", maxPrice: 250, notes: "black", buyerName: "Alex" };
const seller = { id: "s1", name: "Ferdi" };

describe("Repo", () => {
  it("creates, lists and cascades deletes for wants", () => {
    const w = repo.createWant(wantInput);
    repo.addSeller({ wantId: w.id, name: "Ferdi", persona: "ferdi", endpoint: "mock://ferdi" });
    const t = createThread(w, seller);
    repo.saveThread(t);
    repo.addMessage(t.id, { from: "buyer", text: "hi", at: 1, price: 175 });
    expect(repo.listWants()).toHaveLength(1);
    expect(repo.listSellers(w.id)).toHaveLength(1);
    expect(repo.deleteWant(w.id)).toBe(true);
    expect(repo.listSellers(w.id)).toHaveLength(0);
    expect(repo.getThread(t.id)).toBeUndefined();
  });

  it("round-trips a thread with ordered messages and updates it in place", () => {
    const w = repo.createWant(wantInput);
    const t = createThread(w, seller);
    repo.saveThread(t);
    repo.addMessage(t.id, { from: "buyer", text: "one", at: 1, price: 175 });
    repo.addMessage(t.id, { from: "seller", text: "two", at: 2, price: 300 });
    t.lastOffer = 175; t.lastAsk = 300; t.refusals = 1; t.status = "walked_away"; t.reason = "over_budget";
    repo.saveThread(t);
    const back = repo.getThread(t.id)!;
    expect(back.messages.map((m) => m.text)).toEqual(["one", "two"]);
    expect(back).toMatchObject({ lastOffer: 175, lastAsk: 300, refusals: 1, status: "walked_away", reason: "over_budget" });
    expect(repo.listThreads(w.id)).toHaveLength(1);
  });

  it("creates one deal per thread (idempotent) and updates payment fields", () => {
    const w = repo.createWant(wantInput);
    const t = createThread(w, seller);
    t.status = "deal"; t.dealPrice = 205;
    repo.saveThread(t);
    const d1 = repo.createDeal(t);
    const d2 = repo.createDeal(t);
    expect(d2.id).toBe(d1.id);
    expect(d1).toMatchObject({ price: 205, status: "awaiting_payment" });
    repo.updateDeal(d1.id, { status: "order_created", paypalOrderId: "ORD1" });
    expect(repo.getDealByOrder("ORD1")?.id).toBe(d1.id);
    expect(repo.listDeals(w.id)).toHaveLength(1);
  });

  it("refuses a non-positive budget at the database level", () => {
    expect(() => repo.createWant({ ...wantInput, maxPrice: 0 })).toThrow();
  });
});
