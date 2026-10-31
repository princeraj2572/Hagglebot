import { handle } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const restart = new URL(req.url).searchParams.get("restart") === "1";
  return handle(req, () => ({ threads: getServices().runner.start(id, { restart }).map((t) => t.id) }), 202);
}
