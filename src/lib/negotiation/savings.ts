import type { Thread } from "./types";

export interface DealRow {
  seller: string;
  /** The first price the seller put on the table. */
  firstAsk: number;
  /** What Hagglebot agreed. */
  price: number;
  /** firstAsk - price; never negative. */
  saved: number;
  /** saved as a whole percent of firstAsk. */
  savedPct: number;
  /** budget - price. The negotiation never closes above budget, so this is 0 or more. */
  underBudget: number;
  /** Bought at the listed price by the user's choice, with no negotiation. */
  direct: boolean;
}

export interface Savings {
  /** Deals, cheapest first. */
  rows: DealRow[];
  best: DealRow;
}

/** The numbers behind the "what did Hagglebot save you" panel. Null until at least one deal is closed. */
export function dealSavings(threads: Thread[], budget: number): Savings | null {
  const rows: DealRow[] = [];
  for (const t of threads) {
    if (t.status !== "deal" || t.dealPrice === null) continue;
    const firstAsk = t.messages.find((m) => m.from === "seller" && m.price !== null)?.price ?? t.dealPrice;
    const saved = Math.max(0, firstAsk - t.dealPrice);
    rows.push({
      seller: t.sellerName,
      firstAsk,
      price: t.dealPrice,
      saved,
      savedPct: firstAsk > 0 ? Math.round((saved / firstAsk) * 100) : 0,
      underBudget: Math.max(0, budget - t.dealPrice),
      direct: t.messages.some((m) => m.guard?.startsWith("Bought at the listed price")),
    });
  }
  rows.sort((a, b) => a.price - b.price);
  const best = rows[0];
  return best ? { rows, best } : null;
}
