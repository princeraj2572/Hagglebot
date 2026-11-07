import { NextResponse } from "next/server";
import { transcriptFileName, transcriptMarkdown } from "@/lib/negotiation/transcript";
import { getServices } from "@/server/services";

export const runtime = "nodejs";

/** Downloads one negotiation as a Markdown file: the messages and every guardrail note. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { repo } = getServices();
  const t = repo.getThread(id);
  const want = t && repo.getWant(t.wantId);
  if (!t || !want) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  return new Response(transcriptMarkdown(t, want), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${transcriptFileName(t)}"`,
      "cache-control": "no-store",
    },
  });
}
