import { handle } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, () => {
    if (!getServices().repo.deleteSeller(id)) throw new RunnerError("Seller not found", "not_found");
    return { ok: true };
  });
}
