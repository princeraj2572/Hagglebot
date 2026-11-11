import { MarketplaceError, type Listing, type Page, type SearchOptions } from "../channel3/search";

interface RawListing {
  title?: unknown;
  url?: unknown;
  price?: { amount?: unknown; divisor?: unknown; currency_code?: unknown };
}

/**
 * Etsy Open API v3 search of active listings. Search only: nothing is bought and no seller is messaged.
 * Etsy has no new/used field, so the condition filter is ignored and cards show no condition. The page token is the offset.
 */
export async function searchEtsy(query: string, apiKey: string, opts: SearchOptions = {}): Promise<Page> {
  if (!query) return { listings: [], next: null }; // Etsy's taxonomy differs from Channel3's categories
  const f = opts.fetchImpl ?? fetch;
  const limit = opts.limit ?? 20;
  const offset = Number(opts.pageToken ?? 0) || 0;
  const qs = new URLSearchParams({ keywords: query, limit: String(limit), offset: String(offset), sort_on: "score" });
  if (opts.minPrice !== undefined) qs.set("min_price", String(opts.minPrice));
  if (opts.maxPrice !== undefined) qs.set("max_price", String(opts.maxPrice));

  let res: Response;
  try {
    res = await f(`https://openapi.etsy.com/v3/application/listings/active?${qs}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MarketplaceError("Could not reach Etsy. Try again in a moment.");
  }
  if (res.status === 401 || res.status === 403) throw new MarketplaceError("Etsy rejected the API key. Check ETSY_API_KEY.");
  if (res.status === 429) throw new MarketplaceError("Etsy rate limit used up. Try again later.");
  if (!res.ok) throw new MarketplaceError(`Etsy request failed (HTTP ${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as { results?: RawListing[]; count?: unknown };

  const listings: Listing[] = [];
  for (const r of data.results ?? []) {
    const amount = Number(r.price?.amount);
    const divisor = Number(r.price?.divisor) || 1;
    // Prices are in the shop's currency; only USD ones compare with the budget.
    if (typeof r.title !== "string" || typeof r.url !== "string" || r.price?.currency_code !== "USD" || !Number.isFinite(amount)) continue;
    listings.push({
      title: r.title.slice(0, 120),
      retailer: "etsy.com",
      price: Math.max(1, Math.round(amount / divisor)),
      condition: null,
      url: r.url,
      image: null,
    });
  }
  const more = typeof data.count === "number" && offset + limit < data.count;
  return { listings, next: more ? String(offset + limit) : null };
}
