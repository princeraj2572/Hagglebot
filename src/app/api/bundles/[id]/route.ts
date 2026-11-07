import { handle } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** Deletes the bundle; its wants stay, each with its own budget again. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, () => {
    if (!getServices().repo.deleteBundle(id)) throw new RunnerError("Bundle not found", "not_found");
    return { ok: true };
  });
}
