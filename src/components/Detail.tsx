"use client";
import type { Thread } from "@/lib/negotiation/types";
import { api } from "./api";
import { Avatar, tagline } from "./Avatar";
import { Conversation } from "./Conversation";
import { usd } from "./format";
import { Lane, type Axis } from "./Lane";
import { StatusChip } from "./StatusChip";
import { btn, ghost } from "./ui";

/** One seller in full: who they are, where the haggling stands, and the whole conversation. */
export function Detail(props: {
  t: Thread;
  budget: number;
  axis: Axis;
  busy: boolean;
  replay: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onBack: () => void;
}) {
  const { t, budget, axis, busy, replay, run, onBack } = props;
  const scam = t.reason === "scam_detected";
  const guards = t.messages.filter((m) => m.guard).length;
  const saved = t.status === "deal" && t.dealPrice !== null ? budget - t.dealPrice : 0;
  const edge = scam ? "border-l-scam" : t.status === "deal" ? "border-l-ink" : t.status === "negotiating" ? "border-l-ultra" : t.status === "paused" || t.status === "awaiting_approval" ? "border-l-tag" : "border-l-muted";

  return (
    <article className={`rounded-md border border-l-4 border-line bg-paper p-4 sm:p-5 ${edge}`} data-testid={`thread-${t.sellerName}`}>
      <button className="mb-3 rounded-md py-1 text-sm font-medium text-ultra underline-offset-4 hover:underline xl:hidden" onClick={onBack}>
        Back to all sellers
      </button>

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={t.sellerName} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold leading-tight" title={t.sellerName}>{t.sellerName}</h3>
            <p className="text-sm text-muted">
              {tagline(t.sellerName)}
              {guards > 0 && (
                <span title="Safety checks Hagglebot applied in this conversation, shown under its messages">
                  {" · "}
                  {guards} guardrail {guards === 1 ? "note" : "notes"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {saved > 0 && (
            <span
              className="num relative origin-left bg-tag py-0.5 pl-5 pr-2.5 text-sm font-bold text-ink [clip-path:polygon(12px_0,100%_0,100%_100%,12px_100%,0_50%)] motion-safe:animate-tag-in"
              style={{ animationDelay: "400ms" }}
            >
              <i aria-hidden className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-paper" />
              {usd(saved)} under budget
            </span>
          )}
          <StatusChip status={t.status} scam={scam} />
          {t.status === "negotiating" && !replay && (
            <button className={`${ghost} py-1`} disabled={busy} onClick={() => run(() => api(`/api/threads/${t.id}/pause`, "POST"))}>
              Pause
            </button>
          )}
          {t.status === "paused" && (
            <button className={`${ghost} py-1`} disabled={busy} onClick={() => run(() => api(`/api/threads/${t.id}/resume`, "POST"))}>
              Resume
            </button>
          )}
        </div>
      </header>

      {t.status === "awaiting_approval" && !replay && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-tag bg-tag/15 p-3">
          <p className="min-w-0 text-sm font-medium">
            {t.sellerName} will sell at <span className="num font-bold">{usd(t.lastAsk)}</span>, within your {usd(budget)} budget. Hagglebot is waiting for you.
          </p>
          <span className="flex gap-2">
            <button
              className={`${btn} bg-ultra text-white [@media(hover:hover)]:hover:bg-[#2335b8]`}
              disabled={busy}
              onClick={() => run(() => api(`/api/threads/${t.id}/approve`, "POST"))}
            >
              Accept {usd(t.lastAsk)}
            </button>
            <button className={ghost} disabled={busy} onClick={() => run(() => api(`/api/threads/${t.id}/decline`, "POST"))}>
              Decline
            </button>
          </span>
        </div>
      )}

      <div className="mt-4">
        <Lane t={t} budget={budget} axis={axis} />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <Conversation key={t.id} t={t} />
      </div>
    </article>
  );
}
