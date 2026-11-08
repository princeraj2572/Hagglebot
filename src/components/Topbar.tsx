export type NavPage = "home" | "negotiate" | "marketplace";

/**
 * The one navigation bar, used by the landing page and the dashboard alike: same width, same place,
 * same items. Only the highlighted item and the live count change.
 */
export function Topbar(props: {
  page: NavPage;
  onNavigate: (p: NavPage) => void;
  live: number;
  total: number;
  /** The marketplace needs a Channel3 key; without one the link is not shown. */
  marketplace: boolean;
}) {
  const { page, onNavigate, live, total, marketplace } = props;
  const items: { id: NavPage; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "negotiate", label: "Negotiate" },
    ...(marketplace ? [{ id: "marketplace" as const, label: "Marketplace" }] : []),
  ];
  return (
    <header className="sticky top-2 z-30 mx-auto w-full max-w-7xl px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-line bg-paper px-3 shadow-lift sm:gap-4 sm:px-4">
        <button onClick={() => onNavigate("home")} title="Home" className="flex items-center gap-2 rounded-lg text-[15px] font-semibold tracking-tight transition-transform duration-150 ease-out-strong active:scale-95">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">H</span>
          <span className="sr-only sm:not-sr-only">Hagglebot</span>
        </button>

        <nav aria-label="Pages" className="flex min-w-0 items-center justify-center gap-0.5 text-[13px] sm:gap-1 sm:text-sm">
          {items.map((it) => (
            <button
              key={it.id}
              aria-current={page === it.id ? "page" : undefined}
              onClick={() => onNavigate(it.id)}
              className={`rounded-md px-2 py-1.5 font-medium transition-[background-color,color,transform] duration-150 ease-out-strong active:scale-[0.96] sm:px-3 ${
                page === it.id ? "bg-mist text-ink" : "text-muted [@media(hover:hover)]:hover:text-ink"
              }`}
            >
              {it.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          {live > 0 && (
            <span className="num inline-flex items-center gap-1.5 rounded-md bg-[#E7F7EE] px-2 py-1 text-xs font-medium text-[#15803D]" role="status">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#22C55E] motion-safe:animate-pulse" />
              {live}<span className="hidden sm:inline"> of {total}</span> live
            </span>
          )}
          <span
            className="hidden rounded-md bg-[#E8F0FE] px-2 py-1 text-xs font-medium text-[#2F63F3] sm:inline-flex"
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
