import { handle } from "@/server/http";
import { getServices } from "@/server/services";
import { getState } from "@/server/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request) {
  return handle(req, () => getState(getServices()));
}
