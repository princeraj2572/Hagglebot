import { REASON_TEXT } from "@/lib/negotiation/reasons";

export const usd = (n: number | null | undefined): string => (n === null || n === undefined ? "–" : `$${n.toLocaleString("en-US")}`);

export const REASON_LABEL = REASON_TEXT;

export const time = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
