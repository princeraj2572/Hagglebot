import { handle, readJson } from "@/server/http";
import { getServices } from "@/server/services";
import { parseBundleInput } from "@/server/validate";

export const runtime = "nodejs";

/** A bundle: one total budget shared by several wants. */
export async function POST(req: Request) {
  return handle(
    req,
    async () => {
      const { name, total } = parseBundleInput(await readJson(req));
      return getServices().repo.createBundle(name, total);
    },
    201,
  );
}
