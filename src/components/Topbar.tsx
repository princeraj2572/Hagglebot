import { Avatar } from "./Avatar";
import { primary } from "./ui";

/** The app bar: where you are, whether anything is live, and the one action that matters. */
export function Topbar(props: {
  wantItem: string | undefined;
  llmMode: "llm" | "template" | undefined;
  live: number;
  total: number;
  started: boolean;
  busy: boolean;
  canNegotiate: boolean;
  onNegotiate: () => void;
}) {
  const { wantItem, llmMode, live, total, started, busy, canNegotiate, onNegotiate } = props;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[96rem] items-center gap-4 px-4">
        <span className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight">
          <Avatar name="Hagglebot" />
          Hagglebot
        </span>

        {wantItem && (
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm text-muted md:flex">
            <span>Wants</span>
            <span aria-hidden>/</span>
            <span className="truncate font-medium text-ink">{wantItem}</span>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {live > 0 && (
            <span className="num inline-flex items-center gap-2 rounded-full bg-ultra/10 px-3 py-1 text-sm font-medium text-ultra" role="status">
              <span aria-hidden className="h-2 w-2 rounded-full bg-ultra motion-safe:animate-pulse" />
              <span className="hidden sm:inline">Live: </span>
              {live} of {total}
              <span className="hidden sm:inline"> sellers</span>
            </span>
          )}
          <span
            className="hidden items-center gap-2 rounded-full border border-line px-3 py-1 text-[13px] text-muted lg:inline-flex"
            data-testid="mode-badge"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-ink/40" />
            Sandbox only · Simulated sellers · {llmMode === "llm" ? "AI-written messages" : "template negotiator"}
          </span>
          {wantItem && (
            <button className={primary} disabled={!canNegotiate || busy} onClick={onNegotiate}>
              {started ? "Restart" : "Negotiate"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
