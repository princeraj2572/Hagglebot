import { handle } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, () => {
    const { repo, runner } = getServices();
    for (const t of repo.listThreads(id)) runner.withdraw(t.id); // stop any live loops first
    if (!repo.deleteWant(id)) throw new RunnerError("Want not found", "not_found");
    return { ok: true };
  });
}
