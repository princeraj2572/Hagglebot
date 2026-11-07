import { handle } from "@/server/http";
import { ValidationError, parseListingInput } from "@/server/validate";
import { RunnerError } from "@/server/runner";
import { getServices } from "@/server/services";
import { encodeListing, personaIdForListing } from "@/lib/sellers/listing";

export const runtime = "nodejs";

const MAX_SELLERS = 8;
const PER_SEARCH = 4;

/** Finds real retailer listings for the want's item (Channel3) and adds them as sellers. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(
    req,
    async () => {
      const { repo, findListings } = getServices();
      if (!findListings) throw new RunnerError("Real listings need a Channel3 key: set CHANNEL3_API_KEY and restart.", "invalid");
      const want = repo.getWant(id);
      if (!want) throw new RunnerError("Want not found", "not_found");
      if (repo.listThreads(id).some((t) => t.status === "negotiating")) throw new RunnerError("Wait for the negotiation to finish before adding sellers", "conflict");
      const room = MAX_SELLERS - repo.listSellers(id).length;
      if (room <= 0) throw new RunnerError(`At most ${MAX_SELLERS} sellers per want`, "conflict");

      // A listing picked in the marketplace: add exactly that one.
      const text = (await req.text()).slice(0, 8192);
      if (text.trim()) {
        let body: { listing?: unknown };
        try {
          body = JSON.parse(text) as { listing?: unknown };
        } catch {
          throw new ValidationError("Invalid JSON");
        }
        const l = parseListingInput(body?.listing);
        const persona = personaIdForListing(repo.listSellers(id).length);
        return [repo.addSeller({ wantId: id, name: l.retailer, persona, endpoint: encodeListing(persona, l) })];
      }

      // Keep listings a negotiation could plausibly close: not far above the budget, not a different kind of product.
      const found = (await findListings(want.item)).listings.filter((l) => l.price <= want.maxPrice * 1.5 && l.price >= want.maxPrice * 0.4);
      const have = new Set(repo.listSellers(id).map((s) => s.name.replace(/\s+\d+$/, "")));
      const picked = found
        .filter((l) => !have.has(l.retailer) && have.add(l.retailer)) // one seller per retailer, also within this search
        .slice(0, Math.min(PER_SEARCH, room));
      if (picked.length === 0) throw new RunnerError("No real listings near your budget were found. Try a more specific item name.", "conflict");
      return picked.map((l, i) =>
        repo.addSeller({ wantId: id, name: l.retailer, persona: personaIdForListing(i), endpoint: encodeListing(personaIdForListing(i), l) }),
      );
    },
    201,
  );
}
