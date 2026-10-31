import type { ThreadStatus } from "@/lib/negotiation/types";

const STYLE: Record<ThreadStatus, string> = {
  negotiating: "border-accent/60 text-accent",
  deal: "border-accent bg-accent text-navy-950",
  walked_away: "border-slate-600 text-slate-400",
  paused: "border-slate-500 text-slate-300",
};
const LABEL: Record<ThreadStatus, string> = {
  negotiating: "Negotiating",
  deal: "Deal",
  walked_away: "Walked away",
  paused: "Paused",
};

export function StatusChip({ status }: { status: ThreadStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {status === "negotiating" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {LABEL[status]}
    </span>
  );
}
