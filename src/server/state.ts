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
