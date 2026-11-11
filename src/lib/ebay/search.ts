import { MarketplaceError, type Listing, type Page, type SearchOptions } from "../channel3/search";

const API = "https://api.ebay.com";

interface RawItem {
  title?: unknown;
  price?: { value?: unknown; currency?: unknown };
  condition?: unknown;
  itemWebUrl?: unknown;
  image?: { imageUrl?: unknown };
}

// shortcut: one cached app token per process, fine for a single server; refetched ~1 min before expiry.
let token: { key: string; value: string; until: number } | null = null;

async function appToken(clientId: string, secret: string, f: typeof fetch): Promise<string> {
  const key = `${clientId}:${secret}`;
  if (token && token.key === key && Date.now() < token.until) return token.value;
  let res: Response;
  try {
    res = await f(`${API}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(key).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MarketplaceError("Could not reach eBay. Try again in a moment.");
  }
  if (res.status === 400 || res.status === 401) throw new MarketplaceError("eBay rejected the app keys. Check EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.");
  if (!res.ok) throw new MarketplaceError(`eBay sign-in failed (HTTP ${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string") throw new MarketplaceError("eBay sign-in returned no token.");
  const ttl = typeof data.expires_in === "number" ? data.expires_in : 3600;
  token = { key, value: data.access_token, until: Date.now() + (ttl - 60) * 1000 };
  return token.value;
}

/**
 * eBay Browse API search (US, fixed-price and Best Offer listings, no auctions).
 * Search only: nothing is bought and no offer is sent to eBay. The page token is the result offset.
 */
export async function searchEbay(query: string, clientId: string, secret: string, opts: SearchOptions = {}): Promise<Page> {
  if (!query) return { listings: [], next: null }; // eBay's categories differ from Channel3's, so category-only browsing stays on Channel3
  const f = opts.fetchImpl ?? fetch;
  const limit = opts.limit ?? 20;
  const offset = Number(opts.pageToken ?? 0) || 0;
  const filters = ["buyingOptions:{FIXED_PRICE|BEST_OFFER}", "priceCurrency:USD"];
  if (opts.condition !== "any") filters.push(`conditions:{${opts.condition === "used" ? "USED" : "NEW"}}`);
  if (opts.minPrice !== undefined || opts.maxPrice !== undefined) filters.push(`price:[${opts.minPrice ?? ""}..${opts.maxPrice ?? ""}]`);
  const qs = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset), filter: filters.join(",") });

  const bearer = await appToken(clientId, secret, f);
  let res: Response;
  try {
    res = await f(`${API}/buy/browse/v1/item_summary/search?${qs}`, {
      headers: { authorization: `Bearer ${bearer}`, "x-ebay-c-marketplace-id": "EBAY_US" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MarketplaceError("Could not reach eBay. Try again in a moment.");
  }
  if (res.status === 401 || res.status === 403) {
    token = null;
    throw new MarketplaceError("eBay rejected the request. Check the eBay app keys.");
  }
  if (res.status === 429) throw new MarketplaceError("eBay rate limit used up. Try again later.");
  if (!res.ok) throw new MarketplaceError(`eBay request failed (HTTP ${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as { itemSummaries?: RawItem[]; next?: unknown };

  const listings: Listing[] = [];
  for (const it of data.itemSummaries ?? []) {
    const price = Number(it.price?.value);
    if (typeof it.title !== "string" || typeof it.itemWebUrl !== "string" || it.price?.currency !== "USD" || !Number.isFinite(price)) continue;
    listings.push({
      title: it.title.slice(0, 120),
      retailer: "ebay.com",
      price: Math.max(1, Math.round(price)),
      condition: typeof it.condition === "string" ? it.condition.toLowerCase() : null,
      url: it.itemWebUrl,
      image: typeof it.image?.imageUrl === "string" ? it.image.imageUrl : null,
    });
  }
  return { listings, next: typeof data.next === "string" && data.next ? String(offset + limit) : null };
}
