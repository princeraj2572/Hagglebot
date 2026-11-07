import { handle, readJson } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** Puts a want in a bundle ({ bundleId }) or takes it out ({ bundleId: null }). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, async () => {
    const { repo } = getServices();
    const body = (await readJson(req)) as { bundleId?: unknown };
    const bundleId = typeof body.bundleId === "string" && body.bundleId ? body.bundleId : null;
    if (!repo.getWant(id)) throw new RunnerError("Want not found", "not_found");
    if (bundleId && !repo.getBundle(bundleId)) throw new RunnerError("Bundle not found", "not_found");
    repo.setWantBundle(id, bundleId);
    return repo.getWant(id);
  });
}
