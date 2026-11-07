import { handle, readJson } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";
import { parseSellerInput } from "@/server/validate";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(
    req,
    async () => {
      const { repo } = getServices();
      const input = parseSellerInput(await readJson(req));
      const want = repo.getWant(id);
      if (!want) throw new RunnerError("Want not found", "not_found");
      if (repo.listThreads(id).some((t) => t.status === "negotiating")) throw new RunnerError("Wait for the negotiation to finish before adding sellers", "conflict");
      if (repo.listSellers(id).length >= 8) throw new RunnerError("At most 8 sellers per want", "conflict");
      return repo.addSeller({ wantId: id, name: input.name, persona: input.persona, endpoint: `mock://${input.persona}` });
    },
    201,
  );
}
