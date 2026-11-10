import { NEGOTIATION_STYLES, type NegotiationStyle } from "../lib/negotiation/types";
import type { Listing } from "../lib/channel3/search";
import { PERSONAS } from "../lib/sellers/personas";
import { HUMAN_PERSONA } from "../lib/sellers/humanSeller";

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
  bundleId?: string;
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
  return { item, maxPrice, notes, buyerName, ...(style ? { style: style as NegotiationStyle } : {}), ...(b.requireApproval === true ? { requireApproval: true } : {}), ...(clean(b.bundleId) ? { bundleId: clean(b.bundleId) } : {}) };
}

export interface SellerInput {
  name: string;
  persona: string;
}

export function parseSellerInput(body: unknown): SellerInput {
  const b = obj(body);
  const persona = clean(b.persona);
  const found = persona === HUMAN_PERSONA ? { name: "Live seller" } : PERSONAS.find((p) => p.id === persona);
  if (!found) throw new ValidationError(`Persona must be one of: ${[...PERSONAS.map((p) => p.id), HUMAN_PERSONA].join(", ")}`);
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

export interface BundleInput {
  name: string;
  total: number;
}

export function parseBundleInput(body: unknown): BundleInput {
  const b = obj(body);
  const name = clean(b.name);
  const total = typeof b.total === "number" ? b.total : Number(clean(b.total));
  if (!name || name.length > 60) throw new ValidationError("A bundle needs a name of up to 60 characters");
  if (!Number.isInteger(total) || total < 1 || total > 10_000_000) throw new ValidationError("The bundle budget must be a whole number of dollars, at least 1");
  return { name, total };
}

export interface SellerReplyInput {
  message: string;
  action: "counter" | "accept" | "refuse";
  price: number | null;
}

/** A live seller's reply from their phone. Untrusted: it goes into the negotiation like any seller message. */
export function parseSellerReply(body: unknown): SellerReplyInput {
  const b = obj(body);
  const message = clean(b.message);
  if (!message || message.length > 500) throw new ValidationError("Write a message (max 500 characters)");
  const action = clean(b.action);
  if (action !== "counter" && action !== "accept" && action !== "refuse") throw new ValidationError("Action must be counter, accept or refuse");
  const raw = typeof b.price === "string" && b.price.trim() !== "" ? Number(b.price) : b.price;
  if (raw !== undefined && raw !== null && (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 1_000_000)) {
    throw new ValidationError("Price must be a whole number of dollars between 1 and 1000000");
  }
  return { message, action, price: typeof raw === "number" ? raw : null };
}

export interface CopilotInput {
  want: WantInput;
  askingPrice: number;
  history: { from: "buyer" | "seller"; text: string; price: number | null }[];
}

/** The copilot keeps the chat in the browser and sends it back each turn, so every field is checked here. */
export function parseCopilotInput(body: unknown): CopilotInput {
  const b = obj(body);
  const want = parseWantInput({ ...b, buyerName: clean(b.buyerName) || "my user" });
  const askingPrice = typeof b.askingPrice === "string" && b.askingPrice.trim() !== "" ? Number(b.askingPrice) : b.askingPrice;
  if (typeof askingPrice !== "number" || !Number.isFinite(askingPrice) || askingPrice < 1 || askingPrice > 1_000_000) {
    throw new ValidationError("Asking price must be a number of dollars between 1 and 1000000");
  }
  if (!Array.isArray(b.history) || b.history.length > 30) throw new ValidationError("History must be a list of at most 30 messages");
  const history = b.history.map((h) => {
    const m = obj(h);
    const text = clean(m.text);
    if ((m.from !== "buyer" && m.from !== "seller") || !text || text.length > 1000) throw new ValidationError("Each message needs from (buyer or seller) and text (max 1000 characters)");
    const price = typeof m.price === "number" && Number.isFinite(m.price) && m.price > 0 ? m.price : null;
    return { from: m.from as "buyer" | "seller", text, price };
  });
  return { want, askingPrice: Math.round(askingPrice), history };
}
