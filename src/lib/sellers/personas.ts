export interface Persona {
  id: string;
  name: string;
  /** Opening ask, deliberately high. */
  listPrice: number;
  /** What the item cost the seller. */
  costBasis: number;
  /** Lowest price the seller will ever accept, as a multiple of cost. */
  floorMultiple: number;
  /** Fraction of the gap between ask and offer conceded each round. */
  concessionRate: number;
  /** Accept when the offer is within this fraction of the ask. */
  closeTolerance: number;
  /** Offers below this fraction of the floor are refused outright. */
  refuseBelow: number;
  /** Extra fee (fraction of price) quietly added at close. Sam only. */
  hiddenFeeRate: number;
  style: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "ferdi",
    name: "Fast Ferdi",
    listPrice: 399,
    costBasis: 190,
    floorMultiple: 1.02,
    concessionRate: 0.6,
    closeTolerance: 0.12,
    refuseBelow: 0.85,
    hiddenFeeRate: 0,
    style:
      "You are Fast Ferdi: you start high, but you want a quick sale. You drop your price fast and close early. Short, upbeat messages.",
  },
  {
    id: "fatima",
    name: "Firm Fatima",
    listPrice: 399,
    costBasis: 235,
    floorMultiple: 1.15,
    concessionRate: 0.08,
    closeTolerance: 0.01,
    refuseBelow: 0.85,
    hiddenFeeRate: 0,
    style:
      "You are Firm Fatima: professional and unmoved. Your price reflects real value; you barely budge and politely refuse lowballs. Never rude.",
  },
  {
    id: "chen",
    name: "Chatty Chen",
    listPrice: 399,
    costBasis: 200,
    floorMultiple: 1.06,
    concessionRate: 0.3,
    closeTolerance: 0.04,
    refuseBelow: 0.75,
    hiddenFeeRate: 0,
    style:
      "You are Chatty Chen: warm and kind, you love to talk about the item, shipping stories and the weather, and you concede slowly while chatting. Friendly, a bit long-winded.",
  },
  {
    id: "sam",
    name: "Shady Sam",
    listPrice: 399,
    costBasis: 150,
    floorMultiple: 1.0,
    concessionRate: 0.4,
    closeTolerance: 0.08,
    refuseBelow: 0.75,
    hiddenFeeRate: 0.12,
    style:
      "You are Shady Sam: slick and pushy. You upsell extras (extended warranty, express handling) and, once a price is agreed, you sneak in extra fees and nudge the buyer to pay outside the platform.",
  },
];
