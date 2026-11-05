import type { ThreadStatus } from "@/lib/negotiation/types";

const LABEL: Record<ThreadStatus, string> = {
  negotiating: "Negotiating",
  deal: "Deal",
  walked_away: "Walked away",
  paused: "Paused",
};
const DOT: Record<ThreadStatus, string> = {
  negotiating: "bg-ultra motion-safe:animate-pulse",
  deal: "bg-ink",
  walked_away: "bg-muted",
  paused: "bg-tag",
};

export function StatusChip({ status, scam }: { status: ThreadStatus; scam?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span aria-hidden className={`h-2 w-2 rounded-full ${scam ? "bg-scam" : DOT[status]}`} />
      <span className={scam ? "text-scam" : ""}>{scam ? "Scam detected" : LABEL[status]}</span>
    </span>
  );
}
