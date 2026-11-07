import { handle } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const restart = q.get("restart") === "1";
  const demo = q.get("demo") === "1";
  return handle(req, () => ({ threads: getServices().runner.start(id, { restart, demo }).map((t) => t.id) }), 202);
}
