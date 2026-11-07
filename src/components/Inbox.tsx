import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { usd } from "./format";

/** What this conversation is waiting on, in a few words. */
export function statusLine(t: Thread): string {
  const last = t.messages.at(-1);
  if (t.status === "negotiating") return last?.from === "buyer" ? `${t.sellerName} is replying…` : "Hagglebot is writing…";
  if (t.status === "deal") return "Deal agreed";
  if (t.status === "paused") return "Paused";
  if (t.status === "awaiting_approval") return `Needs your approval: ${usd(t.lastAsk)}`;
  return t.reason === "scam_detected" ? "Scam detected" : "Walked away";
}

/** A small dot says how each conversation stands without reading it. */
function dotFor(t: Thread): string {
  if (t.reason === "scam_detected") return "bg-scam";
  switch (t.status) {
    case "negotiating":
      return "bg-ultra motion-safe:animate-pulse";
    case "deal":
      return "bg-ink";
    case "paused":
    case "awaiting_approval":
      return "bg-tag";
    default:
      return "bg-muted/50";
  }
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
    <ul className="space-y-1.5" aria-label="Sellers">
      {threads.map((t) => {
        const last = t.messages.at(-1);
        const scam = t.reason === "scam_detected";
        const selected = t.id === selectedId;
        const live = t.status === "negotiating";
        const price = t.status === "deal" ? t.dealPrice : t.lastAsk;
        return (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              aria-current={selected}
              className={`flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-[background-color,box-shadow] duration-150 ease-out-strong ${
                selected ? "bg-paper shadow-lift ring-1 ring-ultra/25" : "[@media(hover:hover)]:hover:bg-paper/70"
              }`}
            >
              <Avatar name={t.sellerName} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <i aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dotFor(t)}`} />
                    <span className="truncate font-semibold" title={t.sellerName}>{t.sellerName}</span>
                  </span>
                  <span className="num shrink-0 text-base font-bold">{usd(price)}</span>
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
