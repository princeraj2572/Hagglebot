import type { Message, Thread, ThreadStatus, WalkReason } from "@/lib/negotiation/types";
import type { DashboardState } from "@/server/state";
import type { Deal } from "@/server/repo";

// Dev-only stress fixture: open with ?data=worst. Wants are the scenarios; click through them.
const T0 = 1_700_000_000_000;
const msg = (from: Message["from"], price: number | null, text = "Fair enough, here is my number.", i = 0): Message => ({ from, price, text, at: T0 + i * 1000 });
const noSpace = (n: number) => "Supercalifragilistic".repeat(Math.ceil(n / 20)).slice(0, n);
const long300 = "Scam signals: " + "wire-transfer-only, ".repeat(20).slice(0, 286);

let n = 0;
function thread(wantId: string, sellerName: string, o: Partial<Thread> & { prices?: [number | null, number | null][] } = {}): Thread {
  const { prices, ...rest } = o;
  const messages = rest.messages ?? (prices ?? []).flatMap(([a, b], i) => [msg("seller", a, undefined, i * 2), msg("buyer", b, undefined, i * 2 + 1)]);
  const asks = messages.filter((m) => m.from === "seller" && m.price !== null);
  const offers = messages.filter((m) => m.from === "buyer" && m.price !== null);
  return {
    id: `t${++n}`, wantId, sellerId: `s${n}`, sellerName, status: "negotiating", messages,
    lastAsk: asks.at(-1)?.price ?? null, lastOffer: offers.at(-1)?.price ?? null,
    refusals: 0, reason: null, detail: null, dealPrice: null, ...rest,
  };
}
const walked = (reason: WalkReason, detail: string | null = null): Partial<Thread> => ({ status: "walked_away" as ThreadStatus, reason, detail });

const NAMES = [
  "Bartholomew Fitzgerald-Montgomery & Sons International Trading Holdings Ltd.",
  noSpace(64),
  "X",
  "Zoë 🛍️🔥",
  "विक्रेता राहुल शर्मा",
  "متجر الأمل للإلكترونيات",
  "田中商店 東京",
  "<b>x</b>",
  "Fast Ferdi",
  "Shady Sam",
  "Jo",
  "O'Brien & Daughters",
];

const nm = (i: number): string => NAMES[i] ?? "?";
const wantMain = "w1";
const longText = "Quiet mechanical keyboard with hot-swappable switches and a very long descriptive name";
const threads: Thread[] = [
  // 15 messages x 700 unbroken chars, ask equal to offer, long name
  thread(wantMain, nm(0), {
    messages: Array.from({ length: 15 }, (_, i) => msg(i % 2 ? "buyer" : "seller", 400 - i * 10, noSpace(700), i)),
  }),
  thread(wantMain, nm(1), { prices: [[500, 100], [450, 200], [300, 300]], status: "deal", dealPrice: 300 }),
  thread(wantMain, nm(2), { prices: [[120, 50]], status: "paused", detail: long300 }),
  thread(wantMain, nm(3), { messages: [], lastAsk: null, lastOffer: null }), // zero messages, negotiating
  thread(wantMain, nm(4), { prices: [[1, 1]], status: "deal", dealPrice: 1 }),
  thread(wantMain, nm(5), { prices: [[999999, 100]], ...walked("over_budget", long300) }),
  thread(wantMain, nm(6), { messages: [msg("seller", null, "No price yet"), msg("buyer", null, "Hello")], ...walked("scam_detected", long300) }),
  thread(wantMain, nm(7), { prices: [[0, 0]], ...walked("too_many_refusals", long300) }),
  thread(wantMain, nm(8), { prices: [[300, 100]], ...walked("message_limit", long300) }),
  thread(wantMain, nm(9), { prices: [[300, 100]], ...walked("purchased_elsewhere", long300) }),
  thread(wantMain, nm(10), { prices: [[250, 150]], status: "paused", detail: null }),
  thread(wantMain, nm(11), { prices: [[260, 150]], lastAsk: null, lastOffer: null }),
  // w2: every price identical (degenerate axis)
  thread("w2", "Same Price Sam", { prices: [[100, 100], [100, 100]], status: "deal", dealPrice: 100 }),
  thread("w2", "Same Price Sue", { prices: [[100, 100]] }),
  // w3: budget below every ask
  thread("w3", "Pricey Pat", { prices: [[900, 500], [850, 520]] }),
  // w4: budget above every ask
  thread("w4", "Cheap Chip", { prices: [[20, 5], [18, 10]], status: "deal", dealPrice: 18 }),
  // w5: $999999 and $1
  thread("w5", "Mega Max", { prices: [[999999, 1], [900000, 5]], status: "deal", dealPrice: 900000 }),
  // w8: budget 0 and every price 0 (hi would equal lo)
  thread("w8", "Zero Zed", { prices: [[0, 0]] }),
  // w6: single seller
  thread("w6", "Lonely Lou", { prices: [[100, 80]] }),
];

const deal = (o: Partial<Deal> & Pick<Deal, "id" | "wantId" | "sellerName" | "price" | "status">): Deal => ({
  threadId: "t1", paypalOrderId: null, payerId: null, payerEmail: null, captureId: null, ...o,
});

export function worstCaseState(): DashboardState {
  const w = (id: string, item: string, maxPrice: number, notes: string, sellers: number) => ({
    id, item, maxPrice, notes, buyerName: "Aleksandra Wiśniewska-Kowalczyk", status: "open" as const, createdAt: T0,
    sellers: Array.from({ length: sellers }, (_, i) => ({ id: `${id}s${i}`, wantId: id, name: nm(i % NAMES.length), persona: "ferdi", endpoint: `mock://${noSpace(40)}` })),
  });
  return {
    config: { paypalClientId: "x", paypalBuyerEmail: "bartholomew.fitzgerald@northwind-industries-holdings.example.com", llmMode: "llm", listings: true },
    wants: [
      w(wantMain, `${longText} ${noSpace(40)}`.slice(0, 120), 400, noSpace(250) + " " + "Must ship this week, black only. ".repeat(8).slice(0, 250), 12),
      w("w2", "All prices identical", 100, "", 2),
      w("w3", "Budget below every ask", 50, "", 1),
      w("w4", "Budget above every ask", 5000, "", 1),
      w("w5", "Huge and tiny prices", 1_000_000, "", 1),
      w("w6", "Single seller, no threads yet", 1, "", 1),
      w("w7", "No sellers at all", 0, "", 0),
      w("w8", "Zero budget, zero prices", 0, "", 1),
    ],
    threads,
    deals: [
      deal({ id: "d1", wantId: wantMain, sellerName: nm(0), price: 450, status: "awaiting_payment" }), // over budget 400
      deal({ id: "d2", wantId: wantMain, sellerName: nm(1), price: 300, status: "paid", payerId: null, captureId: null }),
      deal({ id: "d3", wantId: wantMain, sellerName: nm(3), price: 1, status: "refunded" }),
      deal({ id: "d4", wantId: wantMain, sellerName: nm(5), price: 999999, status: "paid", payerId: noSpace(60), captureId: noSpace(60) }),
      deal({ id: "d5", wantId: wantMain, sellerName: nm(7), price: 0, status: "cancelled" }),
      deal({ id: "d6", wantId: wantMain, sellerName: nm(6), price: 12, status: "order_created" }),
    ],
  };
}
