import { DEMO_WANT } from "../lib/demo";
import { DEMO_PERSONAS } from "../lib/sellers/personas";
import type { Thread } from "../lib/negotiation/types";
import type { BundleRecord, Deal, SellerContact, WantRecord } from "./repo";
import type { Services } from "./services";

export interface DashboardState {
  config: Services["publicConfig"];
  bundles: BundleRecord[];
  wants: (WantRecord & { sellers: SellerContact[] })[];
  threads: Thread[];
  deals: Deal[];
}

export function getState(s: Services): DashboardState {
  const { repo } = s;
  return {
    config: s.publicConfig,
    bundles: repo.listBundles(),
    wants: repo.listWants().map((w) => ({ ...w, sellers: repo.listSellers(w.id) })),
    threads: repo.listThreads(),
    deals: repo.listDeals(),
  };
}

/** One click: the fixed demo wishlist with the four simulated sellers. Idempotent while open. */
export function loadDemo(s: Services): { wantId: string; created: boolean } {
  const { repo } = s;
  const existing = repo.listWants().find((w) => w.item === DEMO_WANT.item && w.buyerName === DEMO_WANT.buyerName && w.status === "open");
  if (existing) return { wantId: existing.id, created: false };
  const { id: _id, ...input } = DEMO_WANT;
  const want = repo.createWant(input);
  for (const p of DEMO_PERSONAS) repo.addSeller({ wantId: want.id, name: p.name, persona: p.id, endpoint: `mock://${p.id}` });
  return { wantId: want.id, created: true };
}
