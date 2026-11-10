import { extractAmounts } from "@/lib/negotiation/money";
import { submitHumanReply } from "@/lib/sellers/humanSeller";
import { handle, readJson } from "@/server/http";
import { liveThread } from "@/server/live";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";
import { parseSellerReply, ValidationError } from "@/server/validate";

export const runtime = "nodejs";

/** The live seller answers Hagglebot's latest offer. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, async () => {
    const { t } = liveThread(getServices(), id);
    const input = parseSellerReply(await readJson(req));
    // Accepting means the buyer's current offer; asking for more is a counter.
    const price =
      input.action === "accept" ? t.lastOffer : (input.price ?? extractAmounts(input.message).at(-1) ?? (input.action === "refuse" ? t.lastAsk : null));
    if (input.action === "counter" && price === null) throw new ValidationError("Say your price: put a $ amount in the message or the price box");
    if (!submitHumanReply(t.id, { message: input.message, action: input.action, price })) throw new RunnerError("It is not your turn yet", "conflict");
    return { ok: true };
  });
}
