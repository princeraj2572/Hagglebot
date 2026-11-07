import { LLMUnavailableError, type LLM } from "../llm/types";
import { extractAmounts, fmt } from "../negotiation/money";
import type { Message, Seller, SellerAction, SellerContext, SellerReply } from "../negotiation/types";
import type { Persona } from "./personas";

interface PlannedMove {
  action: SellerAction;
  price: number;
  fee: number;
}

/**
 * A simulated seller. Pricing is deterministic (so the demo is reproducible and the
 * cost basis can never be violated); the LLM only writes the words for the chosen move.
 */
export class PersonaSeller implements Seller {
  readonly id: string;
  readonly name: string;
  private ask: number;

  constructor(
    private readonly persona: Persona,
    private readonly llm: LLM | null,
    /** Resume point after a restart: the last ask this seller quoted. */
    initialAsk: number | null = null,
  ) {
    this.id = persona.id;
    this.name = persona.name;
    this.ask = initialAsk ?? persona.listPrice;
  }

  private get floor(): number {
    return Math.ceil(this.persona.costBasis * this.persona.floorMultiple);
  }

  /** Never returns a price below the floor; the safety property tests rely on. */
  plan(offer: number | null): PlannedMove {
    const p = this.persona;
    if (offer === null) return { action: "counter", price: this.ask, fee: 0 };

    if (offer >= Math.max(this.floor, this.ask * (1 - p.closeTolerance))) {
      this.ask = offer;
      return { action: "accept", price: offer, fee: Math.round(offer * p.hiddenFeeRate) };
    }
    if (offer < this.floor * p.refuseBelow) {
      return { action: "refuse", price: this.ask, fee: 0 };
    }
    const next = Math.max(this.floor, Math.round(this.ask - p.concessionRate * (this.ask - offer)));
    this.ask = Math.min(this.ask, next);
    return { action: "counter", price: this.ask, fee: 0 };
  }

  async respond(ctx: SellerContext): Promise<SellerReply> {
    const move = this.plan(ctx.buyerOffer);
    const text = (await this.write(ctx, move)) ?? this.template(ctx, move);
    return { message: text, price: move.price, action: move.action };
  }

  private describeMove(ctx: SellerContext, m: PlannedMove): string {
    const item = ctx.want.item;
    if (m.action === "accept") {
      return m.fee > 0
        ? `ACCEPT the buyer's offer of ${fmt(m.price)} for the ${item}, BUT add a ${fmt(m.fee)} processing fee (so the total is ${fmt(m.price + m.fee)}) and suggest paying outside the platform to "save time". Be smooth about it.`
        : `ACCEPT the buyer's offer of ${fmt(m.price)} for the ${item}. Say it is a deal.`;
    }
    if (m.action === "refuse") {
      return `REFUSE the buyer's offer as too low. Hold your asking price at ${fmt(m.price)}. Do not mention extra fees or paying outside the platform in this message.`;
    }
    return `COUNTER: your asking price for the ${item} is ${fmt(m.price)}. State that exact number. Do not mention extra fees or paying outside the platform in this message.`;
  }

  private async write(ctx: SellerContext, m: PlannedMove): Promise<string | null> {
    if (!this.llm) return null;
    const transcript = ctx.history.map((h: Message) => `${h.from === "buyer" ? "BUYER" : "YOU"}: ${h.text}`).join("\n");
    try {
      const out = await this.llm.generate({
        system: `You play a seller in a negotiation simulation for a hackathon demo. ${this.persona.style} Facts about your listing (stay consistent with them, never contradict them, never invent other specifics): ${this.persona.facts} Write ONE short chat message (max 3 sentences) in character. First respond to what the buyer actually just said: answer any question using only your facts and react to their reasoning. If the buyer asks about something your facts do not cover, say you are not sure or do not know; never guess. Do not repeat facts you already told the buyer unless they ask again. Then carry out the instruction exactly; never use a price other than the ones given (you may repeat the buyer's current offer). Never repeat a phrase, joke or small-talk topic from your earlier messages: bring something new each time.`,
        turns: [{ role: "user", content: `Conversation so far:\n${transcript || "(none)"}\n\nInstruction: ${this.describeMove(ctx, m)}` }],
        temperature: 0.9,
      });
      const text = out.trim().replace(/^["']|["']$/g, "");
      const allowed = new Set([m.price, m.fee, m.price + m.fee, 39, ...(ctx.buyerOffer !== null ? [ctx.buyerOffer] : [])]);
      const amounts = extractAmounts(text);
      const mentionsPrice = amounts.includes(m.price);
      const onlyAllowed = amounts.every((a) => allowed.has(a));
      const feeOk = m.fee === 0 || amounts.includes(m.fee);
      return text && mentionsPrice && onlyAllowed && feeOk ? text : null;
    } catch (err) {
      if (err instanceof LLMUnavailableError) return null;
      throw err;
    }
  }

  private template(ctx: SellerContext, m: PlannedMove): string {
    const item = ctx.want.item;
    const id = this.persona.id;
    if (m.action === "accept") {
      if (m.fee > 0) {
        return `Deal at ${fmt(m.price)}! Just a ${fmt(m.fee)} processing fee on top, so ${fmt(m.price + m.fee)} total. Easiest is to pay me directly, off the platform, no hassle.`;
      }
      return `You've got a deal at ${fmt(m.price)} for the ${item}!`;
    }
    if (m.action === "refuse") {
      const n = ctx.history.filter((h: Message) => h.from === "seller").length;
      const firm = [
        `I appreciate the interest, but that's well below what it's worth. My price stays at ${fmt(m.price)}.`,
        `I understand, but the price reflects the real condition and value. I'm holding at ${fmt(m.price)}.`,
        `Thank you for the offer, though I can't go that low. ${fmt(m.price)} is firm.`,
        `I've already come as far as I can. The ${item} stays at ${fmt(m.price)}.`,
      ];
      return id === "fatima" ? firm[n % firm.length]! : `Sorry, that's too low for me. I can't go that far. My price is ${fmt(m.price)}.`;
    }
    const own = this.persona.line?.(fmt(m.price), item);
    if (own) return own;
    switch (id) {
      case "ferdi":
        return `Tell you what, ${fmt(m.price)} and it's yours today. I want this gone fast!`;
      case "fatima":
        return `The ${item} is in excellent condition. I can do ${fmt(m.price)}, and that's already a fair price.`;
      case "chen":
        return `Oh, I love that you're interested in the ${item}! I got it on a lovely trip, you know. How about ${fmt(m.price)}? Happy to chat more about it.`;
      default:
        return `I can do ${fmt(m.price)} for the ${item}. For $39 I can add an extended warranty, such a bargain!`;
    }
  }
}
