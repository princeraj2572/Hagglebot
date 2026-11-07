/** A real retailer offer for a product, as returned by Channel3 product search. */
export interface Listing {
  title: string;
  /** Retailer domain, e.g. "bestbuy.com". */
  retailer: string;
  /** Whole US dollars. */
  price: number;
  condition: string | null;
  /** The retailer's buy link. */
  url: string;
}

export class Channel3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Channel3Error";
  }
}

const URL_SEARCH = "https://api.trychannel3.com/v1/search";

interface RawOffer { url?: unknown; domain?: unknown; price?: { price?: unknown; currency?: unknown }; availability?: unknown; condition?: unknown }
interface RawProduct { title?: unknown; offers?: RawOffer[] }

/**
 * Searches Channel3 and returns, per product, its cheapest in-stock USD offer (relevance order kept).
 * Search only: Channel3 returns listings and prices; nothing is bought or sent to a retailer.
 */
export async function searchListings(
  query: string,
  apiKey: string,
  opts: { limit?: number; fetchImpl?: typeof fetch } = {},
): Promise<Listing[]> {
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(URL_SEARCH, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ query, limit: opts.limit ?? 20, filters: { availability: ["InStock"] } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Channel3Error("Could not reach Channel3. Try again in a moment.");
  }
  if (res.status === 401 || res.status === 403) throw new Channel3Error("Channel3 rejected the API key. Check CHANNEL3_API_KEY.");
  if (res.status === 402 || res.status === 429) throw new Channel3Error("Channel3 credits or rate limit used up. Try again later.");
  if (!res.ok) throw new Channel3Error(`Channel3 search failed (HTTP ${res.status}).`);

  const data = (await res.json().catch(() => ({}))) as { products?: RawProduct[] };
  const out: Listing[] = [];
  for (const p of data.products ?? []) {
    const offers = (p.offers ?? [])
      .filter((o) => o.availability === "InStock" && o.price?.currency === "USD" && typeof o.price.price === "number" && typeof o.domain === "string" && typeof o.url === "string")
      .sort((a, b) => (a.price!.price as number) - (b.price!.price as number));
    const best = offers[0];
    if (!best || typeof p.title !== "string") continue;
    out.push({
      title: p.title.slice(0, 120),
      retailer: (best.domain as string).replace(/^www\./, ""),
      price: Math.max(1, Math.round(best.price!.price as number)),
      condition: typeof best.condition === "string" ? best.condition : null,
      url: best.url as string,
    });
  }
  return out;
}
