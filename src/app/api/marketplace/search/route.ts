import { handle, readJson } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** Browse the marketplace: a text search, a category, or both. Nothing is added to a want here. */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { findListings } = getServices();
    if (!findListings) throw new RunnerError("The marketplace needs a Channel3 key: set CHANNEL3_API_KEY and restart.", "invalid");
    const b = (await readJson(req)) as { query?: unknown; category?: unknown };
    const query = typeof b.query === "string" ? b.query.trim().slice(0, 120) : "";
    const category = typeof b.category === "string" && SLUG.test(b.category) ? b.category : undefined;
    if (!query && !category) throw new RunnerError("Type a search or pick a category.", "invalid");
    return findListings(query, category);
  });
}
