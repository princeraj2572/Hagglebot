import { describe, expect, it } from "vitest";
import { DEMO_WANT } from "../demo";
import { PERSONAS } from "../sellers/personas";
import { PersonaSeller } from "../sellers/sellerAgent";
import { approveThread, createThread, declineThread, runNegotiation } from "./engine";
import type { Want } from "./types";

const ask: Want = { ...DEMO_WANT, requireApproval: true };
const noop = { onMessage: () => undefined };

const run = async (want: Want, id = "ferdi") => {
  const seller = new PersonaSeller(PERSONAS.find((p) => p.id === id)!, null);
  const thread = createThread(want, seller);
  await runNegotiation(thread, want, seller, { llm: null, comparing: 4 });
  return thread;
};

describe("approve before accepting", () => {
  it("is off by default: a good price closes the deal on its own", async () => {
    expect((await run(DEMO_WANT)).status).toBe("deal");
  });

  it("stops at an in-budget price and waits, without agreeing to anything", async () => {
    const t = await run(ask);
    expect(t.status).toBe("awaiting_approval");
    expect(t.dealPrice).toBeNull();
    expect(t.lastAsk).not.toBeNull();
    expect(t.lastAsk!).toBeLessThanOrEqual(ask.maxPrice);
    const last = t.messages.at(-1)!;
    expect(last.from).toBe("buyer");
    expect(last.price).toBeNull(); // no price is put on the table
    expect(last.guard).toContain("Paused for your approval");
  });

  it("approving closes the deal at the held price, and says so", async () => {
    const t = await run(ask);
    const held = t.lastAsk!;
    approveThread(t, ask, noop);
    expect(t).toMatchObject({ status: "deal", dealPrice: held });
    expect(t.messages.at(-1)!.guard).toContain(`Accepted $${held} after you approved it`);
  });

  it("declining withdraws politely and records why", async () => {
    const t = await run(ask);
    declineThread(t, noop);
    expect(t).toMatchObject({ status: "walked_away", reason: "declined_by_user" });
    expect(t.messages.at(-1)!.guard).toContain("You declined");
  });

  it("cannot approve or decline a thread that is not waiting", async () => {
    const t = await run(DEMO_WANT);
    expect(() => approveThread(t, DEMO_WANT, noop)).toThrow();
    expect(() => declineThread(t, noop)).toThrow();
  });

  it("never approves above the budget, even if asked", async () => {
    const t = await run(ask);
    t.lastAsk = ask.maxPrice + 1;
    expect(() => approveThread(t, ask, noop)).toThrow();
  });
});
