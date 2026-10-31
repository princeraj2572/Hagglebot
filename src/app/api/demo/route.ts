import { handle } from "@/server/http";
import { getServices } from "@/server/services";
import { loadDemo } from "@/server/state";

export const runtime = "nodejs";

export function POST(req: Request) {
  return handle(req, () => loadDemo(getServices()), 201);
}
