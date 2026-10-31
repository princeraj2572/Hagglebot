import { handle, readJson } from "@/server/http";
import { getServices } from "@/server/services";
import { parseWantInput } from "@/server/validate";

export const runtime = "nodejs";

export function POST(req: Request) {
  return handle(
    req,
    async () => getServices().repo.createWant(parseWantInput(await readJson(req))),
    201,
  );
}
