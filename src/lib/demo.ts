import type { Want } from "./negotiation/types";

/** Fixed scenario so the demo is reproducible. */
export const DEMO_WANT: Want = {
  id: "demo-headphones",
  item: "Sony WH-1000XM5 headphones",
  maxPrice: 250,
  notes: "prefer black, must ship this week",
  buyerName: "Alex",
};
