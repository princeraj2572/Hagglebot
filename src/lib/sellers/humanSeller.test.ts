import { describe, expect, it } from "vitest";
import { HumanSeller, isWaitingForHuman, submitHumanReply } from "./humanSeller";

describe("HumanSeller", () => {
  it("waits for the person's reply", async () => {
    const s = new HumanSeller("s1", "Live seller", "t1");
    expect(submitHumanReply("t1", { message: "early", price: 1, action: "counter" })).toBe(false);
    const pending = s.respond();
    expect(isWaitingForHuman("t1")).toBe(true);
    expect(submitHumanReply("t1", { message: "I can do $200", price: 200, action: "counter" })).toBe(true);
    await expect(pending).resolves.toEqual({ message: "I can do $200", price: 200, action: "counter" });
    expect(isWaitingForHuman("t1")).toBe(false);
  });

  it("gives up after the timeout", async () => {
    const s = new HumanSeller("s2", "Live seller", "t2", 5);
    await expect(s.respond()).rejects.toThrow(/did not reply/);
    expect(isWaitingForHuman("t2")).toBe(false);
  });
});
