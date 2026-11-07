"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Category, Condition, Listing, Page } from "@/lib/channel3/search";
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

/** First few words of a title: a looser query that finds similar products. */
const similarQuery = (title: string): string => title.split(/\s+/).slice(0, 5).join(" ");

const CONDITIONS: { id: Condition; label: string }[] = [
  { id: "new", label: "New" },
  { id: "used", label: "Used and refurbished" },
  { id: "any", label: "Any" },
];

/** A marketplace to browse: every category, a search box, and real products to buy as listed or to negotiate. */
export function MarketplaceView(props: {
  want: Want | undefined;
  /** False while a negotiation is running for the want. */
  canAdd: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onError: (msg: string) => void;
  /** Called after a product was bought at its listed price, so the app can show the deal. */
  onBought: () => void;
}) {
  const { want, canAdd, run, onError, onBought } = props;
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition>("new");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const latest = useRef(0);

  const whole = (v: string): number | undefined => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined);

  /** `more` asks for the next page and adds it below what is already shown. */
  const search = async (q: string, cat: string | null, cond: Condition, more = false) => {
    if (!q.trim() && !cat) return;
    const mine = ++latest.current;
    setLoading(true);
    try {
      const r = await api<Page>("/api/marketplace/search", "POST", {
        query: q.trim(),
        condition: cond,
        ...(cat ? { category: cat } : {}),
        ...(whole(minPrice) !== undefined ? { minPrice: whole(minPrice) } : {}),
        ...(whole(maxPrice) !== undefined ? { maxPrice: whole(maxPrice) } : {}),
        ...(more && next ? { pageToken: next } : {}),
      });
      if (mine === latest.current) {
        setResults((prev) => {
          if (!more || !prev) return r.listings;
          const seen = new Set(prev.map((l) => l.url));
          return [...prev, ...r.listings.filter((l) => !seen.has(l.url))];
        });
        setNext(r.next);
      }
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
        void search(q, first, "new");
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
  const open = want?.status === "open";
  const budget = want?.maxPrice ?? 0;

  const negotiate = (l: Listing) => run(() => api(`/api/wants/${want!.id}/listings`, "POST", { listing: l }));
  const buy = (l: Listing) =>
    run(async () => {
      await api(`/api/wants/${want!.id}/buy`, "POST", { listing: l });
      onBought();
    });
  const similar = (l: Listing) => {
    const q = similarQuery(l.title);
    setQuery(q);
    setCategory(null);
    setCondition("used");
    void search(q, null, "used");
  };

  /** The three things you can do with a product; the same in the card and the table. */
  const actions = (l: Listing, layout: "card" | "row"): ReactNode => {
    const isAdded = added.has(l.url);
    const href = webUrl(l.url);
    const overBudget = !!want && l.price > budget;
    const negotiateBtn = (
      <button
        className={`${btn} ${layout === "card" ? "flex-1" : "py-1"} ${isAdded ? "border border-line text-muted" : "bg-ultra text-white [@media(hover:hover)]:hover:bg-[#2335b8]"}`}
        disabled={!want || !canAdd || full || isAdded}
        onClick={() => void negotiate(l)}
      >
        {isAdded ? "Added" : "Negotiate this"}
      </button>
    );
    const buyBtn = (
      <button
        className={`${ghost} ${layout === "card" ? "w-full" : "py-1"}`}
        disabled={!want || !open || overBudget}
        title={overBudget ? `Above your ${usd(budget)} budget` : "Skip the haggling and pay the listed price through PayPal"}
        onClick={() => void buy(l)}
      >
        Buy at {usd(l.price)}
      </button>
    );
    const viewLink = href && (
      <a href={href} target="_blank" rel="noopener noreferrer" className={layout === "card" ? `${ghost} text-center` : "text-sm font-medium text-ultra underline-offset-4 hover:underline"}>
        View
      </a>
    );
    const similarBtn = (
      <button
        className={layout === "card" ? "py-0.5 text-left text-[13px] font-medium text-ultra underline-offset-4 hover:underline" : "text-sm font-medium text-ultra underline-offset-4 hover:underline"}
        onClick={() => similar(l)}
      >
        {layout === "card" ? "Find similar you can negotiate" : "Similar"}
      </button>
    );
    return layout === "card" ? (
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex gap-2">
          {negotiateBtn}
          {viewLink}
        </div>
        {buyBtn}
        {similarBtn}
      </div>
    ) : (
      <span className="flex items-center gap-3">
        {negotiateBtn}
        {buyBtn}
        {viewLink}
        {similarBtn}
      </span>
    );
  };

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
      width: 450,
      sortable: false,
      cellRenderer: (p: { data?: Listing }) => (p.data ? actions(p.data, "row") : null),
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
          Real products and prices from Channel3. Stores rarely haggle, so you can buy at the listed price, or have Hagglebot negotiate (simulated; no store is
          contacted). Used and refurbished listings are the most negotiable.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query, category, condition);
        }}
      >
        <div className="min-w-0 flex-1">
          <input className={input} value={query} maxLength={120} placeholder="Search products, e.g. running shoes" aria-label="Search products" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="w-20 shrink-0 sm:w-24">
          <input className={input} inputMode="numeric" value={minPrice} placeholder="Min $" aria-label="Lowest price" onChange={(e) => setMinPrice(e.target.value)} />
        </div>
        <div className="w-20 shrink-0 sm:w-24">
          <input className={input} inputMode="numeric" value={maxPrice} placeholder="Max $" aria-label="Highest price" onChange={(e) => setMaxPrice(e.target.value)} />
        </div>
        <button className={primary} type="submit" disabled={loading}>Search</button>
      </form>

      <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
        <button className={chip(category === null)} aria-pressed={category === null} onClick={() => { setCategory(null); void search(query, null, condition); }}>
          All categories
        </button>
        {categories.map((c) => (
          <button key={c.slug} className={chip(category === c.slug)} aria-pressed={category === c.slug} onClick={() => { setCategory(c.slug); void search(query, c.slug, condition); }}>
            {c.title}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Condition" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Condition</span>
        {CONDITIONS.map((c) => (
          <button key={c.id} className={chip(condition === c.id)} aria-pressed={condition === c.id} onClick={() => { setCondition(c.id); void search(query, category, c.id); }}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">
          {!want
            ? "Select or add a want first to buy or negotiate a product."
            : !open
              ? "This want is already purchased."
              : `For: ${want.item} (budget ${usd(budget)})`}
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
      {results && results.length === 0 && !loading && <p className="text-sm text-muted">No products found. Try another search, category or condition.</p>}

      {view === "table" && results && results.length > 0 && (
        <div className={loading ? "opacity-60" : ""}>
          <DataGrid<Listing> rows={results} columns={columns} height={620} label="Marketplace products" />
        </div>
      )}

      <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 ${loading ? "opacity-60" : ""} ${view === "table" ? "hidden" : ""}`}>
        {(results ?? []).map((l) => {
          const img = webUrl(l.image);
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
                {actions(l, "card")}
              </div>
            </li>
          );
        })}
      </ul>

      {next && !loading && results && results.length > 0 && (
        <div className="flex justify-center">
          <button className={ghost} onClick={() => void search(query, category, condition, true)}>
            Load more products
          </button>
        </div>
      )}
    </section>
  );
}
