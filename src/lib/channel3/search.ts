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
  /** Product image on Channel3's CDN, when it has one. */
  image: string | null;
}

export class Channel3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Channel3Error";
  }
}

const URL_SEARCH = "https://api.trychannel3.com/v1/search";

interface RawOffer { url?: unknown; domain?: unknown; price?: { price?: unknown; currency?: unknown }; availability?: unknown; condition?: unknown }
interface RawImage { url?: unknown; cleaned_url?: unknown; is_main_image?: unknown }
interface RawProduct { title?: unknown; offers?: RawOffer[]; images?: RawImage[] }

const mainImage = (images: RawImage[] | undefined): string | null => {
  const img = images?.find((i) => i.is_main_image) ?? images?.[0];
  const u = img?.cleaned_url ?? img?.url;
  return typeof u === "string" ? u : null;
};

/** One page of results, and the token for the next page (null when there is no more). */
export interface Page {
  listings: Listing[];
  next: string | null;
}

export interface SearchOptions {
  limit?: number;
  category?: string | undefined;
  condition?: Condition | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  /** The `next` of a previous page. */
  pageToken?: string | undefined;
  fetchImpl?: typeof fetch;
}

export type Condition = "new" | "used" | "any";

export interface Category {
  slug: string;
  title: string;
}

async function call(path: string, apiKey: string, f: typeof fetch, init: { method: "GET" | "POST"; body?: unknown }): Promise<unknown> {
  let res: Response;
  try {
    res = await f(`https://api.trychannel3.com${path}`, {
      method: init.method,
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Channel3Error("Could not reach Channel3. Try again in a moment.");
  }
  if (res.status === 401 || res.status === 403) throw new Channel3Error("Channel3 rejected the API key. Check CHANNEL3_API_KEY.");
  if (res.status === 402 || res.status === 429) throw new Channel3Error("Channel3 credits or rate limit used up. Try again later.");
  if (!res.ok) throw new Channel3Error(`Channel3 request failed (HTTP ${res.status}).`);
  return res.json().catch(() => ({}));
}

/** Per product: its cheapest in-stock USD offer (relevance order kept). */
function toListings(data: { products?: RawProduct[]; next_page_token?: unknown }): Page {
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
      image: mainImage(p.images),
    });
  }
  return { listings: out, next: typeof data.next_page_token === "string" && data.next_page_token ? data.next_page_token : null };
}

/**
 * Searches Channel3, or, with no query, lists one category (its browse endpoint needs a filter).
 * Search only: Channel3 returns listings and prices; nothing is bought or sent to a retailer.
 */
export async function searchListings(
  query: string,
  apiKey: string,
  opts: SearchOptions = {},
): Promise<Page> {
  const f = opts.fetchImpl ?? fetch;
  // Channel3 returns new items only unless asked; used ones are the more negotiable kind.
  const conditions = opts.condition === "used" ? ["used"] : opts.condition === "any" ? ["new", "used"] : ["new"];
  const price = {
    ...(opts.minPrice !== undefined ? { min_price: opts.minPrice } : {}),
    ...(opts.maxPrice !== undefined ? { max_price: opts.maxPrice } : {}),
  };
  const filters = {
    availability: ["InStock"],
    conditions,
    ...(opts.category ? { category_ids: [opts.category] } : {}),
    ...(Object.keys(price).length > 0 ? { price } : {}),
  };
  const limit = opts.limit ?? 20;
  if (!query && !opts.category) return { listings: [], next: null };
  const paging = opts.pageToken ? { page_token: opts.pageToken } : {};
  const data = query
    ? await call("/v1/search", apiKey, f, { method: "POST", body: { query, limit, filters, ...paging } })
    : await call("/v1/browse", apiKey, f, { method: "POST", body: { limit, filters, ...paging } });
  return toListings(data as { products?: RawProduct[]; next_page_token?: unknown });
}

/** The top-level product categories (slug is what search and browse filter on). */
export async function listCategories(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<Category[]> {
  const data = (await call("/v1/categories?roots_only=true&page_size=100", apiKey, fetchImpl, { method: "GET" })) as { items?: { slug?: unknown; title?: unknown }[] };
  return (data.items ?? []).flatMap((c) => (typeof c.slug === "string" && typeof c.title === "string" ? [{ slug: c.slug, title: c.title }] : []));
}
