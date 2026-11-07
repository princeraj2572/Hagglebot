
/** The app bar: the logo, the two pages, whether anything is live, and the mode. */
export function Topbar(props: {
  /** The logo reopens the landing page. */
  onHome: () => void;
  wantItem: string | undefined;
  live: number;
  total: number;
  /** Show the page switch only when the marketplace is available (needs a Channel3 key). */
  marketplace: boolean;
  page: "negotiate" | "marketplace";
  onPage: (p: "negotiate" | "marketplace") => void;
}) {
  const { live, total, marketplace, page, onPage, onHome } = props;
  return (
    <header className="sticky top-2 z-30 mx-auto max-w-[96rem] px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 shadow-lift sm:gap-4 sm:px-4">
        <button onClick={onHome} title="Back to the welcome page" className="flex shrink-0 items-center gap-2 rounded-lg text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">H</span>
          <span className="sr-only sm:not-sr-only">Hagglebot</span>
        </button>

        {marketplace && (
          <nav aria-label="Pages" className="mx-auto flex items-center gap-1 text-sm">
            {(["negotiate", "marketplace"] as const).map((p) => (
              <button
                key={p}
                aria-current={page === p ? "page" : undefined}
                onClick={() => onPage(p)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors duration-150 ${
                  page === p ? "bg-mist text-ink" : "text-muted [@media(hover:hover)]:hover:text-ink"
                }`}
              >
                {p === "negotiate" ? "Negotiate" : "Marketplace"}
              </button>
            ))}
          </nav>
        )}

        <div className={`${marketplace ? "" : "ml-auto"} flex shrink-0 items-center gap-2 whitespace-nowrap`}>
          {live > 0 && (
            <span className="num inline-flex items-center gap-1.5 rounded-md bg-[#E7F7EE] px-2 py-1 text-xs font-medium text-[#15803D]" role="status">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#22C55E] motion-safe:animate-pulse" />
              <span className="hidden sm:inline">Live</span>
              {live} of {total}
            </span>
          )}
          <span
            className="hidden items-center gap-1.5 rounded-md bg-[#E8F0FE] px-2 py-1 text-xs font-medium text-[#2F63F3] sm:inline-flex"
            data-testid="mode-badge"
            title="Sellers, negotiation and payments are simulated. No real money moves."
          >
            Simulation
          </span>
        </div>
      </div>
    </header>
  );
}
