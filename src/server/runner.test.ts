import { describe, expect, it } from "vitest";
import { makeKit, seedDemo } from "./testkit";

describe("NegotiationRunner", () => {
  it("runs all four sellers in parallel and persists threads, messages and deals", async () => {
    const { repo, runner } = makeKit();
    const want = seedDemo(repo);
    runner.start(want.id);
    await runner.idle();

    const byName = Object.fromEntries(repo.listThreads(want.id).map((t) => [t.sellerName, t]));
    expect(byName["Fast Ferdi"]).toMatchObject({ status: "deal", dealPrice: 205 });
    expect(byName["Chatty Chen"]).toMatchObject({ status: "deal", dealPrice: 246 });
    expect(byName["Firm Fatima"]).toMatchObject({ status: "walked_away", reason: "too_many_refusals" });
    expect(byName["Shady Sam"]).toMatchObject({ status: "walked_away", reason: "scam_detected" });
    expect(byName["Fast Ferdi"]!.messages.length).toBe(7);
    expect(repo.listDeals(want.id).map((d) => [d.sellerName, d.price, d.status]).sort()).toEqual([
      ["Chatty Chen", 246, "awaiting_payment"],
      ["Fast Ferdi", 205, "awaiting_payment"],
    ]);
  });

  it("rejects bad starts: unknown want, no sellers, double start; allows restart", async () => {
    const { repo, runner } = makeKit();
    expect(() => runner.start("nope")).toThrow(/not found/);
    const empty = repo.createWant({ item: "x", maxPrice: 10, notes: "", buyerName: "A" });
    expect(() => runner.start(empty.id)).toThrow(/at least one seller/);
    const want = seedDemo(repo);
    runner.start(want.id);
    expect(() => runner.start(want.id)).toThrow(/already started/);
    await runner.idle();
    runner.start(want.id, { restart: true });
    await runner.idle();
    expect(repo.listThreads(want.id)).toHaveLength(4);
    expect(repo.listDeals(want.id)).toHaveLength(2);
  });

  it("pause is a killswitch and resume continues to the same outcome", async () => {
    const { repo, runner } = makeKit();
    const want = seedDemo(repo);
    const [ferdi] = runner.start(want.id);
    runner.pause(ferdi!.id);
    await runner.idle();
    const paused = repo.getThread(ferdi!.id)!;
    expect(paused.status).toBe("paused");
    expect(paused.messages.length).toBeLessThan(7);
    expect(() => runner.pause(ferdi!.id)).toThrow(/Cannot pause/);

    runner.resume(ferdi!.id);
    await runner.idle();
    expect(repo.getThread(ferdi!.id)).toMatchObject({ status: "deal", dealPrice: 205 });
  });

  it("recovers threads interrupted by a restart as paused, and they can resume", async () => {
    const { repo, runner } = makeKit();
    const want = seedDemo(repo);
    const contact = repo.listSellers(want.id)[0]!;
    const t = { id: "stale", wantId: want.id, sellerId: contact.id, sellerName: contact.name, status: "negotiating" as const,
      messages: [], lastOffer: 175, lastAsk: 265, refusals: 0, reason: null, detail: null, dealPrice: null };
    repo.saveThread(t);
    expect(runner.recoverInterrupted()).toBe(1);
    expect(repo.getThread("stale")!.status).toBe("paused");
    runner.resume("stale");
    await runner.idle();
    expect(repo.getThread("stale")!.status).toBe("deal");
  });
});
