import { handle } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** Demo mode (?demo=1) payment: canned, clearly labelled ids, PayPal is never called. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, () => getServices().payments.demoPay(id));
}
