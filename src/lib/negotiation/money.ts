export function fmt(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** All dollar amounts in a text, e.g. "$1,234.50" -> 1234.5. */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g)) {
    const n = Number((m[1] ?? "").replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}
