import { describe, expect, it } from "vitest";
import { runBenchmark } from "./benchmark";

describe("runBenchmark", () => {
  it("holds every safety claim over many negotiations", async () => {
    const card = await runBenchmark(120);
    expect(card.runs).toBe(120);
    expect(card.deals).toBeGreaterThan(0);
    expect(card.budgetBreaches).toBe(0);
    expect(card.budgetLeaks).toBe(0);
    expect(card.scamAttempts).toBeGreaterThan(0);
    expect(card.scamDeals).toBe(0);
    expect(card.injectionAttempts).toBeGreaterThan(0);
    expect(card.injectionsFlagged).toBe(card.injectionAttempts);
    expect(card.avgSaved).toBeGreaterThan(0);
  });

  it("is repeatable", async () => {
    expect(await runBenchmark(30, 7)).toEqual(await runBenchmark(30, 7));
  });
});
