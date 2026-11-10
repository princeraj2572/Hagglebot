import type { Seller, SellerReply } from "../negotiation/types";

/** The persona id of a seller played live by a person on their phone ("Beat the bot"). */
export const HUMAN_PERSONA = "human";

/** Replies the negotiation is waiting for, by thread id. On globalThis so it survives Next.js dev hot reloads. */
const g = globalThis as unknown as { __hagglebotWaiting?: Map<string, (r: SellerReply) => void> };
const waiting = (g.__hagglebotWaiting ??= new Map<string, (r: SellerReply) => void>());

/**
 * A seller whose replies come from a person instead of a persona. respond() waits until the person
 * answers through submitHumanReply(); a timeout fails the step, which pauses the thread safely.
 */
export class HumanSeller implements Seller {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly threadId: string,
    private readonly timeoutMs = 10 * 60_000,
  ) {}

  respond(): Promise<SellerReply> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(this.threadId);
        reject(new Error("The live seller did not reply within 10 minutes"));
      }, this.timeoutMs);
      waiting.set(this.threadId, (r) => {
        clearTimeout(timer);
        waiting.delete(this.threadId);
        resolve(r);
      });
    });
  }
}

export const isWaitingForHuman = (threadId: string): boolean => waiting.has(threadId);

/** Hands the person's reply to the waiting negotiation. False when it is not their turn. */
export function submitHumanReply(threadId: string, reply: SellerReply): boolean {
  const answer = waiting.get(threadId);
  if (!answer) return false;
  answer(reply);
  return true;
}
