"use client";
import { useState } from "react";
import { dealSavings, type DealRow } from "@/lib/negotiation/savings";
import type { Thread } from "@/lib/negotiation/types";
import { DataGrid, type ColDef } from "./DataGrid";
import { usd } from "./format";

const money = (p: { value?: number | null }): string => usd(p.value ?? null);

/** Every closed deal side by side, folded away until asked for. The headline numbers live in the scoreboard above. */
export function SavingsPanel({ threads, budget }: { threads: Thread[]; budget: number }) {
  const [open, setOpen] = useState(false);
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
            {p.value} <span className="ml-1 rounded-md bg-tag px-2 py-0.5 text-[12px] font-semibold">Best price</span>
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
    <section aria-label="Savings" className="min-w-0">
      <button
        className="inline-flex items-center gap-2 rounded-md bg-paper px-4 py-2 text-sm font-semibold transition-colors duration-150 [@media(hover:hover)]:hover:bg-mist"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Compare deals ({rows.length})
        <span aria-hidden className={`text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mt-3 rounded-xl bg-paper p-3 sm:p-4">
          <DataGrid<DealRow> rows={rows} columns={columns} label="Closed deals compared" />
        </div>
      )}
    </section>
  );
}
