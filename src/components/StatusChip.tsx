import type { ThreadStatus } from "@/lib/negotiation/types";

const LABEL: Record<ThreadStatus, string> = {
  negotiating: "Negotiating",
  deal: "Deal",
  walked_away: "Walked away",
  paused: "Paused",
  awaiting_approval: "Needs your approval",
};
const TONE: Record<ThreadStatus, { chip: string; dot: string }> = {
  negotiating: { chip: "bg-[#E8F0FE] text-[#1D4ED8]", dot: "bg-ultra motion-safe:animate-pulse" },
  deal: { chip: "bg-[#DCF5E4] text-[#15803D]", dot: "bg-[#22C55E]" },
  walked_away: { chip: "bg-mist text-muted", dot: "bg-muted/60" },
  paused: { chip: "bg-[#EEF0F4] text-[#475569]", dot: "bg-[#94A3B8]" },
  awaiting_approval: { chip: "bg-[#FDF0C2] text-[#8A6100]", dot: "bg-[#F5A524]" },
};

export function StatusChip({ status, scam }: { status: ThreadStatus; scam?: boolean }) {
  const tone = scam ? { chip: "bg-[#FFDFE0] text-[#B42318]", dot: "bg-scam" } : TONE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-medium ${tone.chip}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {scam ? "Scam detected" : LABEL[status]}
    </span>
  );
}
