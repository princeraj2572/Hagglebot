import { Avatar } from "./Avatar";

/** The app bar: the logo, the two pages, whether anything is live, and the mode. */
export function Topbar(props: {
  wantItem: string | undefined;
  llmMode: "llm" | "template" | undefined;
  live: number;
  total: number;
  /** Show the page switch only when the marketplace is available (needs a Channel3 key). */
  marketplace: boolean;
  /** ?demo=1: canned negotiation and a mock payment. */
  demo: boolean;
  page: "negotiate" | "marketplace";
  onPage: (p: "negotiate" | "marketplace") => void;
}) {
  const { llmMode, live, total, marketplace, page, onPage, demo } = props;
  return (
    <header className="sticky top-0 z-30 bg-chalk/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <span className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight">
          <Avatar name="Hagglebot" />
          <span className="sr-only sm:not-sr-only">Hagglebot</span>
        </span>

        {marketplace && (
          <nav aria-label="Pages" className="flex items-center gap-0.5 rounded-full bg-mist p-1">
            {(["negotiate", "marketplace"] as const).map((p) => (
              <button
                key={p}
                aria-current={page === p ? "page" : undefined}
                onClick={() => onPage(p)}
                className={`rounded-full px-2.5 py-1.5 text-sm font-semibold transition-[background-color,color,box-shadow] sm:px-3.5 duration-150 ${
                  page === p ? "bg-paper text-ink shadow-sm" : "text-muted [@media(hover:hover)]:hover:text-ink"
                }`}
              >
                {p === "negotiate" ? "Negotiate" : "Marketplace"}
              </button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap sm:gap-3">
          {live > 0 && (
            <span className="num inline-flex items-center gap-2 rounded-full bg-ultra px-3 py-1 text-sm font-semibold text-white" role="status">
              <span aria-hidden className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
              <span className="hidden sm:inline">Live: </span>
              {live} of {total}
              <span className="hidden sm:inline"> sellers</span>
            </span>
          )}
          {demo ? (
            <span className="inline-flex items-center rounded-full bg-tag px-2.5 py-1 text-[13px] font-semibold sm:px-3" data-testid="mode-badge" role="status">
              Demo mode<span className="hidden sm:inline"> · canned negotiation and payment, no PayPal</span>
            </span>
          ) : (
            <span
              className="hidden items-center gap-2 rounded-full bg-mist px-3 py-1 text-[13px] font-medium text-muted lg:inline-flex"
              data-testid="mode-badge"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink/40" />
              Sandbox only · Simulated sellers · {llmMode === "llm" ? "AI-written messages" : "template negotiator"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
