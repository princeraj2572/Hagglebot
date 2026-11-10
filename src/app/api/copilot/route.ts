import { copilotNext } from "@/lib/negotiation/copilot";
import { handle, readJson } from "@/server/http";
import { parseCopilotInput } from "@/server/validate";

export const runtime = "nodejs";

/** Drafts the next message for a negotiation the person runs themselves on a real marketplace. */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { want, askingPrice, history } = parseCopilotInput(await readJson(req, 48 * 1024));
    return copilotNext({ id: "copilot", ...want }, askingPrice, history);
  });
}
