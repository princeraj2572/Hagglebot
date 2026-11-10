import { HUMAN_PERSONA } from "../lib/sellers/humanSeller";
import { RunnerError } from "./runner";
import type { Services } from "./services";

/** A thread played by a live seller. Persona threads are never reachable through the seller endpoints. */
export function liveThread({ repo }: Services, id: string) {
  const t = repo.getThread(id);
  const want = t && repo.getWant(t.wantId);
  const contact = t && repo.listSellers(t.wantId).find((c) => c.id === t.sellerId);
  if (!t || !want || contact?.persona !== HUMAN_PERSONA) throw new RunnerError("Live seller chat not found", "not_found");
  return { t, want };
}
