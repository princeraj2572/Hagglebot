import { describe, expect, it } from "vitest";
import { searchListings } from "./search";

const offer = (domain: string, price: number, extra: Record<string, unknown> = {}) => ({
  url: `https://${domain}/p`, domain, price: { price, currency: "USD" }, availability: "InStock", ...extra,
});
const fake = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("searchListings", () => {
  it("returns each product's cheapest in-stock USD offer, rounded, in relevance order", async () => {
    const f = fake(200, {
      products: [
        { title: "A", offers: [offer("www.shop.com", 120.6), offer("cheap.com", 99.4, { condition: "used" }), offer("gone.com", 10, { availability: "OutOfStock" })] },
        { title: "B", offers: [{ ...offer("eur.com", 50), price: { price: 50, currency: "EUR" } }] },
        { title: "C", offers: [offer("c.com", 75)] },
      ],
    });
    const out = await searchListings("x", "key", { fetchImpl: f });
    expect(out).toEqual([
      { title: "A", retailer: "cheap.com", price: 99, condition: "used", url: "https://cheap.com/p" },
      { title: "C", retailer: "c.com", price: 75, condition: null, url: "https://c.com/p" },
    ]);
  });

  it("turns key, credit and server problems into clear errors", async () => {
    await expect(searchListings("x", "k", { fetchImpl: fake(401, {}) })).rejects.toThrow("API key");
    await expect(searchListings("x", "k", { fetchImpl: fake(402, {}) })).rejects.toThrow("credits");
    await expect(searchListings("x", "k", { fetchImpl: fake(500, {}) })).rejects.toThrow("HTTP 500");
  });

  it("sends the key in x-api-key and never anywhere else", async () => {
    let seen: RequestInit | undefined;
    const f = (async (_u: unknown, init?: RequestInit) => ((seen = init), new Response("{}", { status: 200 }))) as unknown as typeof fetch;
    await searchListings("shoes", "secret-key", { fetchImpl: f });
    expect((seen!.headers as Record<string, string>)["x-api-key"]).toBe("secret-key");
    expect(String(seen!.body)).not.toContain("secret-key");
  });
});
