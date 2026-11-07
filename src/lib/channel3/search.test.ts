import { describe, expect, it } from "vitest";
import { listCategories, searchListings } from "./search";

const offer = (domain: string, price: number, extra: Record<string, unknown> = {}) => ({
  url: `https://${domain}/p`, domain, price: { price, currency: "USD" }, availability: "InStock", ...extra,
});
const fake = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("searchListings", () => {
  it("returns each product's cheapest in-stock USD offer, rounded, in relevance order", async () => {
    const f = fake(200, {
      products: [
        { title: "A", images: [{ url: "https://cdn/a2", is_main_image: false }, { url: "https://cdn/a1", cleaned_url: "https://cdn/a1c", is_main_image: true }], offers: [offer("www.shop.com", 120.6), offer("cheap.com", 99.4, { condition: "used" }), offer("gone.com", 10, { availability: "OutOfStock" })] },
        { title: "B", offers: [{ ...offer("eur.com", 50), price: { price: 50, currency: "EUR" } }] },
        { title: "C", offers: [offer("c.com", 75)] },
      ],
    });
    const out = (await searchListings("x", "key", { fetchImpl: f })).listings;
    expect(out).toEqual([
      { title: "A", retailer: "cheap.com", price: 99, condition: "used", url: "https://cheap.com/p", image: "https://cdn/a1c" },
      { title: "C", retailer: "c.com", price: 75, condition: null, url: "https://c.com/p", image: null },
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

  it("browses a category when there is no query, and filters a search by category", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const f = (async (u: string, init?: RequestInit) => {
      calls.push({ url: String(u), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await searchListings("", "k", { category: "electronics", fetchImpl: f });
    await searchListings("shoes", "k", { category: "apparel-accessories", fetchImpl: f });
    expect(calls[0]!.url).toContain("/v1/browse");
    expect(calls[0]!.body.filters).toMatchObject({ category_ids: ["electronics"] });
    expect(calls[1]!.url).toContain("/v1/search");
    expect(calls[1]!.body).toMatchObject({ query: "shoes", filters: { category_ids: ["apparel-accessories"] } });
  });

  it("asks for new items by default, and used ones or both on request", async () => {
    const bodies: { filters: { conditions: string[] } }[] = [];
    const f = (async (_u: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await searchListings("tv", "k", { fetchImpl: f });
    await searchListings("tv", "k", { condition: "used", fetchImpl: f });
    await searchListings("tv", "k", { condition: "any", fetchImpl: f });
    expect(bodies.map((b) => b.filters.conditions)).toEqual([["new"], ["used"], ["new", "used"]]);
  });

  it("returns nothing for an empty query with no category, without calling Channel3", async () => {
    const f = (async () => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    expect(await searchListings("", "k", { fetchImpl: f })).toEqual({ listings: [], next: null });
  });
});

describe("searchListings paging and price", () => {
  it("sends the price range, and the page token when asked for the next page", async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = (async (_u: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ products: [], next_page_token: "NEXT" }), { status: 200 });
    }) as unknown as typeof fetch;
    const first = await searchListings("tv", "k", { minPrice: 50, maxPrice: 300, fetchImpl: f });
    expect(first.next).toBe("NEXT");
    expect(bodies[0]).toMatchObject({ filters: { price: { min_price: 50, max_price: 300 } } });
    expect(bodies[0]).not.toHaveProperty("page_token");
    await searchListings("tv", "k", { pageToken: "NEXT", fetchImpl: f });
    expect(bodies[1]).toMatchObject({ page_token: "NEXT" });
    expect(bodies[1]!.filters).not.toHaveProperty("price");
  });

  it("reports no next page when Channel3 gives none", async () => {
    expect((await searchListings("tv", "k", { fetchImpl: fake(200, { products: [], next_page_token: null }) })).next).toBeNull();
  });
});

describe("listCategories", () => {
  it("returns slug and title for each top-level category and skips malformed ones", async () => {
    const f = fake(200, { items: [{ slug: "electronics", title: "Electronics" }, { slug: 5 }, { title: "x" }] });
    expect(await listCategories("k", f)).toEqual([{ slug: "electronics", title: "Electronics" }]);
  });
});
