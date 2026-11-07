import { describe, expect, it } from "vitest";
import type { Listing } from "../channel3/search";
import { encodeListing, listingFromEndpoint, listingPersona, personaFromEndpoint, personaIdForListing } from "./listing";
import { PERSONAS } from "./personas";
import { PersonaSeller } from "./sellerAgent";

const l: Listing = { title: "Sony WH-1000XM6", retailer: "bestbuy.com", price: 378, condition: "new", url: "https://bestbuy.com/x", image: null };

describe("real listing sellers", () => {
  it("never gives a real retailer a scam personality", () => {
    for (let i = 0; i < 30; i++) {
      const p = PERSONAS.find((x) => x.id === personaIdForListing(i))!;
      expect(p.hiddenFeeRate).toBe(0);
    }
  });

  it("takes the real price, retailer name and facts, and keeps the persona's ratios", () => {
    const base = PERSONAS.find((p) => p.id === "bea")!;
    const p = listingPersona(base, l);
    expect(p.name).toBe("bestbuy.com");
    expect(p.listPrice).toBe(378);
    expect(p.costBasis / p.listPrice).toBeCloseTo(base.costBasis / base.listPrice, 5);
    expect(p.facts).toContain("Sony WH-1000XM6");
    expect(p.facts).toContain("bestbuy.com");
  });

  it("opens at the real price and never goes below its floor", () => {
    const seller = new PersonaSeller(personaFromEndpoint(encodeListing("tomas", l)), null);
    expect(seller.plan(null)).toMatchObject({ action: "counter", price: 378 });
    expect(seller.plan(1).action).toBe("refuse");
    const floor = Math.ceil(PERSONAS.find((p) => p.id === "tomas")!.costBasis * (378 / 399) * 1.08);
    expect(seller.plan(floor + 20).price).toBeGreaterThanOrEqual(floor);
  });

  it("reads a stored listing back for the Listings view, and ignores anything else", () => {
    expect(listingFromEndpoint(encodeListing("bea", { ...l, image: "https://cdn.example/i.png" }))).toEqual({ ...l, image: "https://cdn.example/i.png" });
    expect(listingFromEndpoint("mock://ferdi")).toBeNull();
    expect(listingFromEndpoint("listing:%7Bbroken")).toBeNull();
  });

  it("rejects a malformed stored listing", () => {
    expect(() => personaFromEndpoint("listing:%7B%22p%22%3A%22nobody%22%7D")).toThrow("Malformed");
  });
});
