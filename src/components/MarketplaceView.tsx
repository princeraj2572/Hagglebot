"use client";
import { useEffect, useRef, useState } from "react";
import type { Category, Listing } from "@/lib/channel3/search";
import { listingFromEndpoint } from "@/lib/sellers/listing";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { DataGrid, type ColDef } from "./DataGrid";
import { usd } from "./format";
import { btn, ghost, input, primary } from "./ui";

type Want = DashboardState["wants"][number];

const webUrl = (u: string | null | undefined): string | null => {
  try {
    return u && ["http:", "https:"].includes(new URL(u).protocol) ? u : null;
  } catch {
    return null;
  }
};

/** A marketplace to browse: every category, a search box, and a grid of real products to negotiate. */
export function MarketplaceView(props: {
  want: Want | undefined;
  /** False once negotiations have started for the want. */
  canAdd: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const { want, canAdd, run, onError } = props;
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const latest = useRef(0);

  const search = async (q: string, cat: string | null) => {
    if (!q.trim() && !cat) return;
    const mine = ++latest.current;
    setLoading(true);
    try {
      const r = await api<Listing[]>("/api/marketplace/search", "POST", { query: q.trim(), ...(cat ? { category: cat } : {}) });
      if (mine === latest.current) setResults(r);
    } catch (e) {
      if (mine === latest.current) onError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  };

  // First open: load the categories and show products for the selected want's item (or the first category).
  useEffect(() => {
    let off = false;
    api<Category[]>("/api/marketplace/categories")
      .then((c) => {
        if (off) return;
        setCategories(c);
        const q = want?.item ?? "";
        setQuery(q);
        const first = q ? null : (c[0]?.slug ?? null);
        setCategory(first);
        void search(q, first);
      })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
    return () => {
      off = true;
    };
    // Runs once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const added = new Set((want?.sellers ?? []).flatMap((s) => listingFromEndpoint(s.endpoint)?.url ?? []));
  const full = (want?.sellers.length ?? 0) >= 8;
  const addable = !!want && canAdd && !full;
  const columns: ColDef<Listing>[] = [
    {
      headerName: "",
      field: "image",
      width: 72,
      sortable: false,
      cellRenderer: (p: { value?: string | null }) => {
        const u = webUrl(p.value);
        // eslint-disable-next-line @next/next/no-img-element
        return u ? <img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 object-contain" /> : null;
      },
    },
    { field: "title", headerName: "Product", flex: 3, minWidth: 220, filter: "agTextColumnFilter", tooltipField: "title" },
    { field: "retailer", headerName: "Store", flex: 1, minWidth: 130, filter: "agTextColumnFilter" },
    { field: "price", headerName: "Price", width: 110, type: "rightAligned", filter: "agNumberColumnFilter", valueFormatter: (p) => usd(p.value as number), cellStyle: { fontWeight: 600 } },
    { field: "condition", headerName: "Condition", width: 120, filter: "agTextColumnFilter", valueFormatter: (p) => (p.value as string | null) ?? "–" },
    {
      headerName: "",
      colId: "act",
      width: 210,
      sortable: false,
      cellRenderer: (p: { data?: Listing }) => {
        const l = p.data;
        if (!l) return null;
        const isAdded = added.has(l.url);
        const href = webUrl(l.url);
        return (
          <span className="flex items-center gap-2">
            <button
              className={`${btn} py-1 ${isAdded ? "border border-line text-muted" : "bg-ultra text-white"}`}
              disabled={!addable || isAdded}
              onClick={() => run(() => api(`/api/wants/${want!.id}/listings`, "POST", { listing: l }))}
            >
              {isAdded ? "Added" : "Negotiate this"}
            </button>
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ultra underline-offset-4 hover:underline">
                View
              </a>
            )}
          </span>
        );
      },
    },
  ];

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-sm transition-colors duration-150 ${
      active ? "border-ultra bg-ultra/10 font-medium text-ultra" : "border-line [@media(hover:hover)]:hover:border-ink/40"
    }`;

  return (
    <section aria-label="Marketplace" className="min-w-0 space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Marketplace</h2>
        <p className="mt-1 text-sm text-muted">
          Real products and prices from Channel3. Pick the ones you want Hagglebot to negotiate; the haggling is simulated and no store is contacted.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query, category);
        }}
      >
        <input className={input} value={query} maxLength={120} placeholder="Search products, e.g. running shoes" aria-label="Search products" onChange={(e) => setQuery(e.target.value)} />
        <button className={primary} type="submit" disabled={loading}>Search</button>
      </form>

      <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
        <button className={chip(category === null)} aria-pressed={category === null} onClick={() => { setCategory(null); void search(query, null); }}>
          All categories
        </button>
        {categories.map((c) => (
          <button key={c.slug} className={chip(category === c.slug)} aria-pressed={category === c.slug} onClick={() => { setCategory(c.slug); void search(query, c.slug); }}>
            {c.title}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted" role="status">
        {!want
          ? "Select or add a want first to negotiate a product."
          : !canAdd
            ? "Negotiations have started for this want. Restart it to change its sellers."
            : full
              ? "This want already has 8 sellers."
              : `Adding to: ${want.item}`}
        {results && !loading ? ` · ${results.length} products` : ""}
      </p>
      <div role="group" aria-label="View" className="flex gap-1">
        {(["cards", "table"] as const).map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={chip(view === v)}>
            {v === "cards" ? "Cards" : "Table"}
          </button>
        ))}
      </div>
      </div>

      {loading && !results && <p className="text-sm text-muted">Loading products…</p>}
      {results && results.length === 0 && !loading && <p className="text-sm text-muted">No products found. Try another search or category.</p>}

      {view === "table" && results && results.length > 0 && (
        <div className={loading ? "opacity-60" : ""}>
          <DataGrid<Listing> rows={results} columns={columns} height={620} label="Marketplace products" />
        </div>
      )}

      <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 ${loading ? "opacity-60" : ""} ${view === "table" ? "hidden" : ""}`}>
        {(results ?? []).map((l) => {
          const img = webUrl(l.image);
          const href = webUrl(l.url);
          const isAdded = added.has(l.url);
          return (
            <li key={l.url} className="flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-paper">
              <div className="flex h-36 items-center justify-center bg-chalk">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm text-muted">No image</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="break-all text-[13px] font-medium text-muted">{l.retailer}</span>
                <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug" title={l.title}>{l.title}</h3>
                <p className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
                  <span className="num text-xl font-bold">{usd(l.price)}</span>
                  {l.condition && <span className="rounded-full border border-line px-2 py-0.5 text-[12px] text-muted">{l.condition}</span>}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className={`${btn} flex-1 ${isAdded ? "border border-line text-muted" : "bg-ultra text-white [@media(hover:hover)]:hover:bg-[#2335b8]"}`}
                    disabled={!want || !canAdd || full || isAdded}
                    onClick={() => run(() => api(`/api/wants/${want!.id}/listings`, "POST", { listing: l }))}
                  >
                    {isAdded ? "Added" : "Negotiate this"}
                  </button>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={`${ghost} text-center`}>
                      View
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
