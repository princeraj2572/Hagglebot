import { handle } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** Mock payment: records labelled MOCK ids and runs the follow-up. No money moves. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, () => getServices().payments.pay(id));
}
