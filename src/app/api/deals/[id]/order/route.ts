import { handle } from "@/server/http";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(req, async () => {
    const { orderId } = await getServices().payments.createOrderForDeal(id);
    return { orderId };
  });
}
