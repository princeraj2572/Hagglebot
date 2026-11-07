import { NextResponse } from "next/server";
import { ValidationError } from "./validate";

const MAX_BODY = 8 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ValidationError("Content-Type must be application/json");
  }
  const text = await req.text();
  if (text.length > MAX_BODY) throw new ValidationError("Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Invalid JSON");
  }
}

/** Reject cross-site browser requests; same-origin and non-browser clients pass. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("host") ?? new URL(req.url).host);
  } catch {
    return false;
  }
}

/**
 * Match by name, not instanceof: Next.js can bundle a route and the shared services separately,
 * so the same error class may exist twice and instanceof would miss it.
 */
const isNamed = (err: unknown, name: string): err is Error & { code: string } => err instanceof Error && err.name === name;

function toResponse(err: unknown): NextResponse {
  const json = (error: string, status: number) => NextResponse.json({ error }, { status });
  if (isNamed(err, "ValidationError")) return json(err.message, 400);
  if (isNamed(err, "RunnerError")) return json(err.message, err.code === "not_found" ? 404 : err.code === "conflict" ? 409 : 400);
  if (isNamed(err, "Channel3Error")) return json(err.message, 502);
  if (isNamed(err, "PaymentError")) {
    const status = ({ not_configured: 503, not_found: 404, conflict: 409, paypal: 502 } as Record<string, number>)[err.code] ?? 500;
    return json(err.message, status);
  }
  console.error("Unhandled API error", err);
  return json("Internal server error", 500);
}

/** Wraps a route body: origin check, JSON result, uniform error mapping. */
export async function handle(req: Request, fn: () => Promise<unknown> | unknown, status = 200): Promise<NextResponse> {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  try {
    return NextResponse.json(await fn(), { status });
  } catch (err) {
    return toResponse(err);
  }
}
