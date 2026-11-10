import { runBenchmark } from "@/lib/negotiation/benchmark";
import { handle } from "@/server/http";

export const runtime = "nodejs";

/** Runs n simulated negotiations (default 200, at most 1000) and returns the safety scorecard. */
export async function GET(req: Request) {
  const n = Number(new URL(req.url).searchParams.get("n") ?? 200);
  return handle(req, () => runBenchmark(Number.isInteger(n) && n > 0 ? Math.min(n, 1000) : 200));
}
