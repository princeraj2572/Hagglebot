import { describe, expect, it } from "vitest";
import { searchEbay } from "./search";
import { searchEtsy } from "../etsy/search";
import { mergeSources } from "../channel3/search";

type Call = { url: string; init?: RequestInit | undefined };
const recorder = (responses: Record<string, unknown>) => {
  const calls: Call[] = [];
  const f = (async (u: string, init?: RequestInit) => {
    calls.push({ url: String(u), init });
    const key = Object.keys(responses).find((k) => String(u).includes(k))!;
    return new Response(JSON.stringify(responses[key]), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("searchEbay", () => {
  it("signs in once, filters to fixed-price USD, maps items and pages by offset", async () => {
    const { f, calls } = recorder({
      oauth2: { access_token: "tok", expires_in: 7200 },
      item_summary: {
        next: "more",
        itemSummaries: [
          { title: "Camera", price: { value: "199.60", currency: "USD" }, condition: "Used", itemWebUrl: "https://ebay.com/itm/1", image: { imageUrl: "https://i.ebayimg.com/1.jpg" } },
          { title: "Euro", price: { value: "10", currency: "EUR" }, itemWebUrl: "https://ebay.com/itm/2" },
        ],
      },
    });
    const page = await searchEbay("camera", "id-a", "secret", { condition: "used", maxPrice: 300, limit: 12, fetchImpl: f });
    await searchEbay("camera", "id-a", "secret", { pageToken: page.next!, fetchImpl: f });

    expect(page).toEqual({
      listings: [{ title: "Camera", retailer: "ebay.com", price: 200, condition: "used", url: "https://ebay.com/itm/1", image: "https://i.ebayimg.com/1.jpg" }],
      next: "12",
    });
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1); // token cached
    const search = new URL(calls[1]!.url);
    expect(search.searchParams.get("filter")).toBe("buyingOptions:{FIXED_PRICE|BEST_OFFER},priceCurrency:USD,conditions:{USED},price:[..300]");
    expect((calls[1]!.init!.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(new URL(calls[2]!.url).searchParams.get("offset")).toBe("12");
  });

  it("does not call eBay for a category-only browse", async () => {
    const { f, calls } = recorder({});
    expect(await searchEbay("", "id-b", "s", { category: "electronics", fetchImpl: f })).toEqual({ listings: [], next: null });
    expect(calls).toHaveLength(0);
  });
});

describe("searchEtsy", () => {
  it("keeps USD listings, divides the price and pages by offset", async () => {
    const { f, calls } = recorder({
      etsy: {
        count: 30,
        results: [
          { title: "Mug", url: "https://etsy.com/listing/1", price: { amount: 2450, divisor: 100, currency_code: "USD" } },
          { title: "Pound mug", url: "https://etsy.com/listing/2", price: { amount: 2000, divisor: 100, currency_code: "GBP" } },
        ],
      },
    });
    const page = await searchEtsy("mug", "key", { limit: 12, minPrice: 5, fetchImpl: f });
    expect(page).toEqual({ listings: [{ title: "Mug", retailer: "etsy.com", price: 25, condition: null, url: "https://etsy.com/listing/1", image: null }], next: "12" });
    expect(new URL(calls[0]!.url).searchParams.get("min_price")).toBe("5");
    expect((calls[0]!.init!.headers as Record<string, string>)["x-api-key"]).toBe("key");
  });
});

describe("mergeSources", () => {
  const L = (t: string) => ({ title: t, retailer: "x.com", price: 1, condition: null, url: "https://x.com", image: null });

  it("interleaves sources and only asks those with more on the next page", async () => {
    const asked: string[] = [];
    const sources = {
      a: async (t?: string) => (asked.push(`a:${t}`), { listings: [L("a1"), L("a2")], next: t ? null : "a-next" }),
      b: async (t?: string) => (asked.push(`b:${t}`), { listings: [L("b1")], next: null }),
    };
    const first = await mergeSources(sources);
    expect(first.listings.map((l) => l.title)).toEqual(["a1", "b1", "a2"]);
    const second = await mergeSources(sources, first.next!);
    expect(asked).toEqual(["a:undefined", "b:undefined", "a:a-next"]);
    expect(second.next).toBeNull();
  });

  it("returns the working sources when one fails, and throws only when all fail", async () => {
    const boom = async () => {
      throw new Error("down");
    };
    expect((await mergeSources({ a: boom, b: async () => ({ listings: [L("b1")], next: null }) })).listings).toHaveLength(1);
    await expect(mergeSources({ a: boom })).rejects.toThrow("down");
  });
});
