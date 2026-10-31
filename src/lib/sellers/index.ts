import type { LLM } from "../llm/types";
import type { Seller } from "../negotiation/types";
import { PERSONAS } from "./personas";
import { PersonaSeller } from "./sellerAgent";

export { PERSONAS } from "./personas";
export { PersonaSeller } from "./sellerAgent";

/** Fresh seller instances (they hold per-negotiation price state). */
export function createDemoSellers(llm: LLM | null): Seller[] {
  return PERSONAS.map((p) => new PersonaSeller(p, llm));
}
