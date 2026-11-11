import { handle } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  return handle(req, () => getServices().payments.captureForOrder(orderId));
}
