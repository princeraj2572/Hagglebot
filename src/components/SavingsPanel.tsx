import { dealSavings, type DealRow } from "@/lib/negotiation/savings";
import type { Thread } from "@/lib/negotiation/types";
import { DataGrid, type ColDef } from "./DataGrid";
import { usd } from "./format";

const money = (p: { value?: number | null }): string => usd(p.value ?? null);

/** What Hagglebot saved, and every closed deal side by side. Shows nothing until a deal exists. */
export function SavingsPanel({ threads, budget }: { threads: Thread[]; budget: number }) {
  const s = dealSavings(threads, budget);
  if (!s) return null;
  const { best, rows } = s;

  const columns: ColDef<DealRow>[] = [
    {
      field: "seller",
      headerName: "Seller",
      flex: 2,
      minWidth: 160,
      cellRenderer: (p: { data?: DealRow; value?: string }) =>
        p.data && p.data === best && rows.length > 1 ? (
          <span>
            {p.value} <span className="ml-1 rounded-full bg-tag px-2 py-0.5 text-[12px] font-semibold">Best price</span>
          </span>
        ) : (
          p.value
        ),
    },
    { field: "firstAsk", headerName: "First ask", type: "rightAligned", flex: 1, minWidth: 100, valueFormatter: money },
    { field: "price", headerName: "Agreed", type: "rightAligned", flex: 1, minWidth: 100, valueFormatter: money, cellStyle: { fontWeight: 600 }, sort: "asc" },
    {
      field: "saved",
      headerName: "Saved",
      type: "rightAligned",
      flex: 1,
      minWidth: 120,
      valueFormatter: (p) => (p.data && p.data.saved > 0 ? `${usd(p.data.saved)} (${p.data.savedPct}%)` : "–"),
    },
    { field: "underBudget", headerName: "Under budget", type: "rightAligned", flex: 1, minWidth: 120, valueFormatter: money },
  ];

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

      <div className="mt-3">
        <DataGrid<DealRow> rows={rows} columns={columns} label="Closed deals compared" />
      </div>
    </section>
  );
}
