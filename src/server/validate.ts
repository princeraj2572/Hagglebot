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
  return { item, maxPrice, notes, buyerName };
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
