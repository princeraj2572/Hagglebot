import { describe, expect, it } from "vitest";
import { ValidationError, parseSellerInput, parseWantInput } from "./validate";

const ok = { item: "  Headphones ", maxPrice: 250, notes: "black", buyerName: "Alex" };

describe("parseWantInput", () => {
  it("trims and accepts a valid want, incl. numeric strings", () => {
    expect(parseWantInput(ok)).toEqual({ item: "Headphones", maxPrice: 250, notes: "black", buyerName: "Alex" });
    expect(parseWantInput({ ...ok, maxPrice: "99" }).maxPrice).toBe(99);
  });
  it.each([
    ["missing item", { ...ok, item: " " }],
    ["fractional price", { ...ok, maxPrice: 9.5 }],
    ["zero price", { ...ok, maxPrice: 0 }],
    ["huge price", { ...ok, maxPrice: 1e9 }],
    ["NaN price", { ...ok, maxPrice: "abc" }],
    ["empty price", { ...ok, maxPrice: "" }],
    ["long notes", { ...ok, notes: "x".repeat(501) }],
    ["no buyer name", { ...ok, buyerName: "" }],
    ["array body", []],
    ["null body", null],
  ])("rejects %s", (_n, body) => {
    expect(() => parseWantInput(body)).toThrow(ValidationError);
  });
  it("strips control characters", () => {
    expect(parseWantInput({ ...ok, item: "A\u0000B\u0007C" }).item).toBe("ABC");
  });
});

describe("parseSellerInput", () => {
  it("defaults the name from the persona and rejects unknown personas", () => {
    expect(parseSellerInput({ persona: "sam" })).toEqual({ persona: "sam", name: "Shady Sam" });
    expect(parseSellerInput({ persona: "sam", name: "Sammy" }).name).toBe("Sammy");
    expect(() => parseSellerInput({ persona: "mallory" })).toThrow(ValidationError);
  });
});
