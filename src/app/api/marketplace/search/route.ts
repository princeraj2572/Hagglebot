import { handle, readJson } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** Browse the marketplace: a text search, a category, or both. Nothing is added to a want here. */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { findListings } = getServices();
    if (!findListings) throw new RunnerError("The marketplace needs a key: set CHANNEL3_API_KEY, EBAY_CLIENT_ID + EBAY_CLIENT_SECRET, or ETSY_API_KEY and restart.", "invalid");
    const b = (await readJson(req)) as { query?: unknown; category?: unknown; condition?: unknown; minPrice?: unknown; maxPrice?: unknown; pageToken?: unknown };
    const query = typeof b.query === "string" ? b.query.trim().slice(0, 120) : "";
    const category = typeof b.category === "string" && SLUG.test(b.category) ? b.category : undefined;
    if (!query && !category) throw new RunnerError("Type a search or pick a category.", "invalid");
    const condition = b.condition === "used" || b.condition === "any" ? b.condition : undefined;
    const price = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000 ? v : undefined);
    const minPrice = price(b.minPrice);
    const maxPrice = price(b.maxPrice);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw new RunnerError("The lowest price is above the highest.", "invalid");
    const pageToken = typeof b.pageToken === "string" && b.pageToken.length > 0 && b.pageToken.length <= 4096 ? b.pageToken : undefined;
    return findListings(query, { category, condition, minPrice, maxPrice, pageToken });
  });
}
