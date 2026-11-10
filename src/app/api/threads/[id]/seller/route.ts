import { isWaitingForHuman } from "@/lib/sellers/humanSeller";
import { handle } from "@/server/http";
import { liveThread } from "@/server/live";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** The live seller's view: the chat without the buyer's guardrail notes, which talk about the budget. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, () => {
    const { t, want } = liveThread(getServices(), id);
    return {
      item: want.item,
      sellerName: t.sellerName,
      status: t.status,
      yourTurn: isWaitingForHuman(t.id),
      buyerOffer: t.lastOffer,
      messages: t.messages.map((m) => ({ from: m.from, text: m.text, price: m.price, at: m.at, ...(m.from === "seller" && m.guard ? { guard: m.guard } : {}) })),
    };
  });
}
