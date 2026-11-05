import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { usd } from "./format";

const EDGE = {
  scam: "border-l-scam",
  deal: "border-l-ink",
  negotiating: "border-l-ultra",
  paused: "border-l-tag",
  walked_away: "border-l-muted",
} as const;

/** What this conversation is waiting on, in a few words. */
export function statusLine(t: Thread): string {
  const last = t.messages.at(-1);
  if (t.status === "negotiating") return last?.from === "buyer" ? `${t.sellerName} is replying…` : "Hagglebot is writing…";
  if (t.status === "deal") return "Deal agreed";
  if (t.status === "paused") return "Paused";
  return t.reason === "scam_detected" ? "Scam detected" : "Walked away";
}

/** The list of every seller Hagglebot is talking to, like an inbox: who, what state, latest words, current price. */
export function Inbox(props: {
  threads: Thread[];
  selectedId: string | undefined;
  unread: (t: Thread) => boolean;
  onSelect: (id: string) => void;
}) {
  const { threads, selectedId, unread, onSelect } = props;
  return (
    <ul className="space-y-2" aria-label="Sellers">
      {threads.map((t) => {
        const last = t.messages.at(-1);
        const scam = t.reason === "scam_detected";
        const edge = scam ? EDGE.scam : EDGE[t.status];
        const selected = t.id === selectedId;
        const live = t.status === "negotiating";
        const price = t.status === "deal" ? t.dealPrice : t.lastAsk;
        return (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              aria-current={selected}
              className={`flex w-full items-start gap-3 rounded-md border border-l-4 p-3 text-left transition-[background-color,box-shadow] duration-150 ease-out ${edge} ${
                selected ? "border-line bg-paper shadow-[0_0_0_2px_rgba(43,63,214,0.35)]" : "border-line bg-paper/60 [@media(hover:hover)]:hover:bg-paper"
              }`}
            >
              <Avatar name={t.sellerName} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold" title={t.sellerName}>{t.sellerName}</span>
                  <span className="num shrink-0 text-sm font-semibold">{usd(price)}</span>
                </span>
                <span className={`block truncate text-[13px] ${live ? "font-medium text-ultra" : scam ? "font-medium text-scam" : "text-muted"}`}>
                  {statusLine(t)}
                </span>
                {last && (
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {last.from === "buyer" ? "Hagglebot: " : ""}
                    {last.text}
                  </span>
                )}
              </span>
              {unread(t) && !selected && (
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ultra">
                  <span className="sr-only">New messages</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
