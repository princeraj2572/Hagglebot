"use client";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

/** AG Grid dressed in Hagglebot's own tokens, so a table looks like the rest of the app. */
const theme = themeQuartz.withParams({
  accentColor: "#2F63F3",
  backgroundColor: "#FFFFFF",
  foregroundColor: "#0E1424",
  borderColor: "#DCE1EB",
  headerBackgroundColor: "#E8ECF4",
  headerTextColor: "#586174",
  headerFontWeight: 600,
  fontFamily: "inherit",
  fontSize: 14,
  wrapperBorderRadius: 12,
  rowHoverColor: "#F1F3F8",
});

export type { ColDef };

const ROW = 44;

/** A sortable, filterable table. Pass `height` for a scrolling grid; omit it to fit exactly the header and rows. */
export function DataGrid<T>({ rows, columns, height, label }: { rows: T[]; columns: ColDef<T>[]; height?: number; label: string }) {
  return (
    <div aria-label={label} style={{ height: height ?? (rows.length + 1) * ROW + 4 }} className="min-w-0">
      <AgGridReact<T>
        theme={theme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={{ sortable: true, resizable: true }}
        rowHeight={ROW}
        headerHeight={ROW}
        suppressCellFocus
        tooltipShowDelay={400}
      />
    </div>
  );
}
