import { NEGOTIATION_STYLES, type NegotiationStyle } from "../lib/negotiation/types";
import type { Listing } from "../lib/channel3/search";
import { PERSONAS } from "../lib/sellers/personas";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const clean = (v: unknown): string => (typeof v === "string" ? v.replace(CONTROL, "").trim() : "");

function obj(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ValidationError("Expected a JSON object");
  return body as Record<string, unknown>;
}

export interface WantInput {
  item: string;
  maxPrice: number;
  notes: string;
  buyerName: string;
  style?: NegotiationStyle;
  requireApproval?: boolean;
}

export function parseWantInput(body: unknown): WantInput {
  const b = obj(body);
  const item = clean(b.item);
  const notes = clean(b.notes);
  const buyerName = clean(b.buyerName);
  const maxPrice = typeof b.maxPrice === "string" && b.maxPrice.trim() !== "" ? Number(b.maxPrice) : b.maxPrice;
  if (!item || item.length > 120) throw new ValidationError("Item name is required (max 120 characters)");
  if (typeof maxPrice !== "number" || !Number.isInteger(maxPrice) || maxPrice < 1 || maxPrice > 100_000) {
    throw new ValidationError("Max price must be a whole number of dollars between 1 and 100000");
  }
  if (notes.length > 500) throw new ValidationError("Notes are limited to 500 characters");
  if (!buyerName || buyerName.length > 60) throw new ValidationError("Your name is required (max 60 characters)");
  const style = clean(b.style);
  if (style && !(NEGOTIATION_STYLES as string[]).includes(style)) {
    throw new ValidationError(`Style must be one of: ${NEGOTIATION_STYLES.join(", ")}`);
  }
  return { item, maxPrice, notes, buyerName, ...(style ? { style: style as NegotiationStyle } : {}), ...(b.requireApproval === true ? { requireApproval: true } : {}) };
}

export interface SellerInput {
  name: string;
  persona: string;
}

export function parseSellerInput(body: unknown): SellerInput {
  const b = obj(body);
  const persona = clean(b.persona);
  const found = PERSONAS.find((p) => p.id === persona);
  if (!found) throw new ValidationError(`Persona must be one of: ${PERSONAS.map((p) => p.id).join(", ")}`);
  const name = clean(b.name) || found.name;
  if (name.length > 60) throw new ValidationError("Seller name is limited to 60 characters");
  return { name, persona };
}

const webUrl = (v: unknown, max = 500, httpsOnly = false): string | null => {
  const u = clean(v);
  if (!u || u.length > max) return null;
  try {
    const p = new URL(u).protocol;
    return p === "https:" || (!httpsOnly && p === "http:") ? u : null;
  } catch {
    return null;
  }
};

/** A listing picked in the marketplace comes from the browser, so every field is checked before it becomes a seller. */
export function parseListingInput(body: unknown): Listing {
  const b = obj(body);
  const title = clean(b.title).slice(0, 120);
  const retailer = clean(b.retailer);
  const url = webUrl(b.url);
  const price = typeof b.price === "number" ? b.price : NaN;
  if (!title || !/^[a-z0-9][a-z0-9.-]{2,59}$/i.test(retailer) || !url || !Number.isInteger(price) || price < 1 || price > 1_000_000) {
    throw new ValidationError("That listing is not valid");
  }
  const condition = clean(b.condition).slice(0, 20);
  return { title, retailer, price, url, condition: condition || null, image: webUrl(b.image, 500, true) };
}
