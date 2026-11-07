import { dealSavings } from "@/lib/negotiation/savings";
import type { Thread } from "@/lib/negotiation/types";
import { usd } from "./format";

/** What Hagglebot saved, and every closed deal side by side. Shows nothing until a deal exists. */
export function SavingsPanel({ threads, budget }: { threads: Thread[]; budget: number }) {
  const s = dealSavings(threads, budget);
  if (!s) return null;
  const { best, rows } = s;

  return (
    <section aria-label="Savings" className="min-w-0 rounded-md border border-line bg-paper p-4">
      <p className="text-sm text-muted">Best deal so far</p>
      <p className="mt-0.5 text-lg font-semibold leading-snug">
        {best.saved > 0 ? (
          <>
            Hagglebot got <span className="num text-ultra">{usd(best.saved)}</span> off{" "}
            <span className="break-all">{best.seller}</span>
            {best.savedPct > 0 ? ` (${best.savedPct}%)` : ""}
          </>
        ) : (
          <>
            <span className="break-all">{best.seller}</span> agreed at its first price
          </>
        )}
        , and <span className="num text-ultra">{usd(best.underBudget)}</span> under your {usd(budget)} budget.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <caption className="sr-only">Closed deals compared</caption>
          <thead>
            <tr className="border-b border-line text-[13px] text-muted">
              <th scope="col" className="py-1.5 pr-3 font-medium">Seller</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">First ask</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Agreed</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Saved</th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">Under budget</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.seller}-${i}`} className="border-b border-line/60 last:border-0">
                <th scope="row" className="py-2 pr-3 font-medium">
                  <span className="break-all">{r.seller}</span>
                  {i === 0 && rows.length > 1 && <span className="ml-2 rounded-full bg-tag px-2 py-0.5 text-[12px] font-semibold">Best price</span>}
                </th>
                <td className="num px-3 py-2 text-right text-muted">{usd(r.firstAsk)}</td>
                <td className="num px-3 py-2 text-right font-semibold">{usd(r.price)}</td>
                <td className="num px-3 py-2 text-right">{r.saved > 0 ? `${usd(r.saved)} (${r.savedPct}%)` : "–"}</td>
                <td className="num py-2 pl-3 text-right">{usd(r.underBudget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
