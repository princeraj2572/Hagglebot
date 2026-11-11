import { handle } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handle(req, async () => {
    const { categories } = getServices();
    if (!categories) throw new RunnerError("The marketplace needs a key: set CHANNEL3_API_KEY, EBAY_CLIENT_ID + EBAY_CLIENT_SECRET, or ETSY_API_KEY and restart.", "invalid");
    return categories();
  });
}
