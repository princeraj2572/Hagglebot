import { handle } from "@/server/http";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";
import { ValidationError, parseListingInput } from "@/server/validate";
import { createThread } from "@/lib/negotiation/engine";
import { encodeListing, listingFromEndpoint, personaIdForListing } from "@/lib/sellers/listing";

export const runtime = "nodejs";

/**
 * Buy a marketplace product at its listed price, skipping the negotiation. The budget ceiling still applies:
 * the buyer agent never agrees to a price above the want's maximum, whether it haggled or not.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(
    req,
    async () => {
      const { repo } = getServices();
      let body: { listing?: unknown };
      try {
        body = JSON.parse((await req.text()).slice(0, 8192)) as { listing?: unknown };
      } catch {
        throw new ValidationError("Invalid JSON");
      }
      const l = parseListingInput(body?.listing);
      const want = repo.getWant(id);
      if (!want) throw new RunnerError("Want not found", "not_found");
      if (want.status !== "open") throw new RunnerError("This want is already purchased", "conflict");
      if (l.price > want.maxPrice) throw new RunnerError(`That price is above your $${want.maxPrice} budget.`, "invalid");
      if (repo.listThreads(id).some((t) => t.status === "negotiating")) throw new RunnerError("Wait for the negotiation to finish first", "conflict");

      const sellers = repo.listSellers(id);
      if (sellers.some((s) => listingFromEndpoint(s.endpoint)?.url === l.url)) {
        throw new RunnerError("You already added this product to this want", "conflict");
      }
      if (sellers.length >= 8) throw new RunnerError("At most 8 sellers per want", "conflict");

      const persona = personaIdForListing(sellers.length);
      const seller = repo.addSeller({ wantId: id, name: l.retailer, persona, endpoint: encodeListing(persona, l) });
      const thread = createThread(want, seller);
      thread.status = "deal";
      thread.dealPrice = l.price;
      thread.lastAsk = l.price;
      thread.lastOffer = l.price;
      const seen = [
        { from: "seller" as const, text: `Listed at $${l.price}: ${l.title}.`, price: l.price },
        {
          from: "buyer" as const,
          text: `You chose to buy this at the listed price of $${l.price}, without negotiating.`,
          price: l.price,
          guard: `Bought at the listed price by your choice. $${l.price} is within your $${want.maxPrice} budget, so Hagglebot allowed it.`,
        },
      ];
      repo.saveThread(thread);
      const now = Date.now();
      seen.forEach((m, i) => repo.addMessage(thread.id, { ...m, at: now + i }));
      return repo.createDeal(thread);
    },
    201,
  );
}
