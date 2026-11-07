import { Avatar } from "./Avatar";

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
    <header className="sticky top-0 z-30 bg-chalk/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <button onClick={onHome} title="Back to the welcome page" className="flex shrink-0 items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight">
          <Avatar name="Hagglebot" />
          <span className="sr-only sm:not-sr-only">Hagglebot</span>
        </button>

        {marketplace && (
          <nav aria-label="Pages" className="flex items-center gap-0.5 rounded-lg bg-mist p-1">
            {(["negotiate", "marketplace"] as const).map((p) => (
              <button
                key={p}
                aria-current={page === p ? "page" : undefined}
                onClick={() => onPage(p)}
                className={`rounded-md px-2.5 py-1.5 text-sm font-semibold transition-[background-color,color,box-shadow] sm:px-3.5 duration-150 ${
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
            <span className="num inline-flex items-center gap-1.5 rounded-md bg-ultra px-2.5 py-1 text-sm font-medium text-white" role="status">
              <span aria-hidden className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
              <span className="hidden sm:inline">Live:</span>
              {live} of {total}
              <span className="hidden sm:inline">sellers</span>
            </span>
          )}
            <span
              className="hidden items-center gap-2 rounded-md bg-mist px-2.5 py-1 text-[13px] font-medium text-muted sm:inline-flex"
              data-testid="mode-badge"
              title="Sellers, negotiation and payments are simulated. No real money moves."
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink/40" />
              Simulation
            </span>
        </div>
      </div>
    </header>
  );
}
