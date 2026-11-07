import type { Listing } from "../channel3/search";
import { PERSONAS, type Persona } from "./personas";

/**
 * A real retailer listing played by a simulated agent: the price, retailer and condition are real,
 * the haggling is not (no retailer is ever contacted). Any persona can play the seller, honest or not.
 */

export const LISTING_PREFIX = "listing:";

/** Picks which persona plays a listing's seller. Random by default; tests pass their own roll. */
export function personaIdForListing(_index: number, roll: () => number = Math.random): string {
  return PERSONAS[Math.floor(roll() * PERSONAS.length) % PERSONAS.length]!.id;
}

/** Scales a persona to the listing's real price; all of a persona's pricing rules are ratios of its list price. */
export function listingPersona(base: Persona, l: Listing): Persona {
  const ratio = l.price / base.listPrice;
  return {
    ...base,
    name: l.retailer,
    listPrice: l.price,
    costBasis: base.costBasis * ratio,
    facts: `This is a real listing: "${l.title}", sold by ${l.retailer}. Condition: ${l.condition ?? "not stated"}. In stock. Listed at $${l.price}. You know nothing else about it; if asked about anything else, say you are not sure.`,
  };
}

export const encodeListing = (personaId: string, l: Listing): string => LISTING_PREFIX + encodeURIComponent(JSON.stringify({ p: personaId, l }));

/** The listing behind a seller's endpoint, or null for a made-up seller or malformed data. */
export function listingFromEndpoint(endpoint: string): Listing | null {
  if (!endpoint.startsWith(LISTING_PREFIX)) return null;
  try {
    const l = (JSON.parse(decodeURIComponent(endpoint.slice(LISTING_PREFIX.length))) as { l?: Listing }).l;
    return l && typeof l.price === "number" && typeof l.retailer === "string" && typeof l.title === "string" ? { ...l, image: l.image ?? null } : null;
  } catch {
    return null;
  }
}

/** Reads a stored listing endpoint back into a persona; throws on anything malformed. */
export function personaFromEndpoint(endpoint: string): Persona {
  const raw = JSON.parse(decodeURIComponent(endpoint.slice(LISTING_PREFIX.length))) as { p?: string; l?: Listing };
  const base = PERSONAS.find((p) => p.id === raw.p);
  const l = raw.l;
  if (!base || !l || typeof l.price !== "number" || !(l.price > 0) || typeof l.retailer !== "string" || typeof l.title !== "string") {
    throw new Error("Malformed listing seller");
  }
  return listingPersona(base, l);
}
