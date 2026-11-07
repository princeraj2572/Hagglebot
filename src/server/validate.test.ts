import { describe, expect, it } from "vitest";
import { ValidationError, parseListingInput, parseSellerInput, parseWantInput } from "./validate";

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

describe("parseWantInput style", () => {
  const base = { item: "Headphones", maxPrice: 250, notes: "", buyerName: "Alex" };
  it("accepts a known style and leaves it off when not given", () => {
    expect(parseWantInput({ ...base, style: "patient" })).toMatchObject({ style: "patient" });
    expect("style" in parseWantInput(base)).toBe(false);
  });
  it("rejects an unknown style", () => {
    expect(() => parseWantInput({ ...base, style: "reckless" })).toThrow(ValidationError);
  });
});

describe("parseListingInput", () => {
  const ok = { title: "Sony WH-1000XM6", retailer: "bestbuy.com", price: 240, url: "https://bestbuy.com/p", condition: "new", image: "https://cdn.trychannel3.com/i.png" };

  it("accepts a listing as the marketplace sends it", () => {
    expect(parseListingInput(ok)).toEqual(ok);
  });

  it("drops an image that is not https, and an empty condition", () => {
    expect(parseListingInput({ ...ok, image: "http://x.com/i.png", condition: "" })).toMatchObject({ image: null, condition: null });
  });

  it.each([
    ["a script link", { url: "javascript:alert(1)" }],
    ["a non-web link", { url: "file:///etc/passwd" }],
    ["a fractional price", { price: 9.5 }],
    ["a zero price", { price: 0 }],
    ["a price that is a string", { price: "240" }],
    ["a retailer with spaces", { retailer: "best buy" }],
    ["an empty title", { title: " " }],
  ])("rejects %s", (_n, patch) => {
    expect(() => parseListingInput({ ...ok, ...patch })).toThrow(ValidationError);
  });
});
