import type { Thread } from "@/lib/negotiation/types";
import { listingFromEndpoint } from "@/lib/sellers/listing";
import type { DashboardState } from "@/server/state";
import { usd } from "./format";
import { btn } from "./ui";

type Seller = DashboardState["wants"][number]["sellers"][number];

/** Only ever link to or load from web addresses; anything else from stored data is dropped. */
const webUrl = (u: string | null | undefined): string | null => {
  try {
    return u && ["http:", "https:"].includes(new URL(u).protocol) ? u : null;
  } catch {
    return null;
  }
};

/** The real retailer listings behind a want's sellers (Channel3), shown as product cards. */
export function ListingsPanel({ sellers, threads }: { sellers: Seller[]; threads: Thread[] }) {
  const items = sellers.flatMap((s) => {
    const l = listingFromEndpoint(s.endpoint);
    return l ? [{ seller: s, l }] : [];
  });
  if (items.length === 0) return null;

  return (
    <section aria-label="Marketplace listings" className="space-y-3">
      <p className="text-sm text-muted">
        Real listings from Channel3, eBay or Etsy. Prices and stores are real; the haggling is simulated and no store is contacted.
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ seller, l }) => {
          const deal = threads.find((t) => t.sellerId === seller.id && t.status === "deal" && t.dealPrice !== null);
          const href = webUrl(l.url);
          const img = webUrl(l.image);
          return (
            <li key={seller.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-paper">
              <div className="flex h-40 items-center justify-center bg-mist">
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
                  <span className="num text-2xl font-bold tracking-tight">{usd(l.price)}</span>
                  {l.condition && <span className="rounded-md bg-mist px-2 py-0.5 text-[12px] font-medium text-muted">{l.condition}</span>}
                </p>
                {deal && <p className="text-[13px] font-medium text-ultra">Hagglebot agreed {usd(deal.dealPrice)}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={`${btn} mt-2 bg-mist text-center [@media(hover:hover)]:hover:bg-[#E4E5E9]`}>
                    View at {l.retailer}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
