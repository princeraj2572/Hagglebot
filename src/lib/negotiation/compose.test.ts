import { describe, expect, it } from "vitest";
import { validateBuyerText } from "./compose";
import { templateBody } from "./templates";
import type { Move } from "./strategy";
import type { Thread, Want } from "./types";

const want: Want = { id: "w", item: "headphones", maxPrice: 250, notes: "", buyerName: "Alex" };
const thread = { lastAsk: 399, messages: [] } as unknown as Thread;
const counter: Move = { type: "counter", price: 190 };

describe("validateBuyerText", () => {
  it("accepts a normal counter-offer", () => {
    expect(validateBuyerText("Could we settle at $190 with shipping included?", counter, thread)).toBe(true);
  });

  it("rejects market claims the buyer was never given", () => {
    expect(validateBuyerText("Similar models are listed around $190, so would you accept that?", counter, thread)).toBe(false);
    expect(validateBuyerText("The market price is lower, so $190 is fair.", counter, thread)).toBe(false);
    expect(validateBuyerText("Considering current market values, I can offer $190.", counter, thread)).toBe(false);
    expect(validateBuyerText("Given current market trends, I can offer $190.", counter, thread)).toBe(false);
    expect(validateBuyerText("That is above the going rate, so I can offer $190.", counter, thread)).toBe(false);
  });

  it("still allows ordinary talk that merely contains related words", () => {
    expect(validateBuyerText("I saw it on the marketplace. Could you do $190?", counter, thread)).toBe(true);
  });

  it("rejects prices it was not given and budget leaks", () => {
    expect(validateBuyerText("How about $150?", counter, thread)).toBe(false);
    expect(validateBuyerText("My budget is tight, but $190 could work.", counter, thread)).toBe(false);
    expect(validateBuyerText("$190 is my absolute limit based on what I'm seeing elsewhere.", counter, thread)).toBe(false);
  });
});

describe("templateBody", () => {
  it("varies the counter-offer wording turn by turn", () => {
    const texts = [1, 2, 3, 4, 5].map((turn) => templateBody(counter, want, { comparing: 1, turn }));
    expect(new Set(texts).size).toBe(5);
    for (const t of texts) expect(t).toContain("$190");
  });
});
