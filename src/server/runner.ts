import type { LLM } from "../lib/llm/types";
import { approveThread, createThread, declineThread, step, type EngineDeps } from "../lib/negotiation/engine";
import type { Seller, Thread, ThreadStatus, WalkReason } from "../lib/negotiation/types";
import type { Repo, SellerContact } from "./repo";

export interface RunnerDeps {
  repo: Repo;
  llm: LLM | null;
  /** `demo` runs with canned text (no language model), for the ?demo=1 mode. */
  sellerFor: (contact: SellerContact, initialAsk: number | null, demo?: boolean) => Seller;
  now?: () => number;
  log?: (msg: string, err?: unknown) => void;
  maxSteps?: number;
  /** Pause between steps so the dashboard reads as a live conversation (0 = as fast as possible). */
  stepDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Reads the status without control-flow narrowing (step() mutates threads across awaits). */
const statusOf = (t: Thread): ThreadStatus => t.status;

export class RunnerError extends Error {
  constructor(message: string, readonly code: "not_found" | "conflict" | "invalid") {
    super(message);
    this.name = "RunnerError";
  }
}

/**
 * Runs negotiations in the background (one async loop per thread, all in parallel),
 * persisting every message and state change so the dashboard can poll live progress.
 */
export class NegotiationRunner {
  private readonly running = new Map<string, Promise<void>>();
  private readonly live = new Map<string, Thread>();
  private readonly paused = new Set<string>();

  constructor(private readonly d: RunnerDeps) {}

  /** Create a thread per seller contact and start them all in parallel. */
  start(wantId: string, opts: { restart?: boolean; demo?: boolean } = {}): Thread[] {
    const { repo } = this.d;
    const want = repo.getWant(wantId);
    if (!want) throw new RunnerError("Want not found", "not_found");
    if (want.status !== "open") throw new RunnerError("This want has already been purchased", "conflict");
    const contacts = repo.listSellers(wantId);
    if (contacts.length === 0) throw new RunnerError("Add at least one seller first", "invalid");

    const existing = repo.listThreads(wantId);
    if (existing.length > 0) {
      if (!opts.restart) throw new RunnerError("Negotiations already started; restart to run them again", "conflict");
      if (repo.listDeals(wantId).some((x) => x.status === "order_created" || x.status === "paid")) {
        throw new RunnerError("A payment is in progress for this want", "conflict");
      }
      for (const t of existing) this.halt(t.id);
      repo.deleteThreadsOfWant(wantId);
    }

    const threads = contacts.map((c) => {
      const t = createThread(want, { id: c.id, name: c.name }, `${wantId}:${c.id}`);
      repo.saveThread(t);
      return t;
    });
    for (const t of threads) {
      this.paused.delete(t.id); // restarted threads reuse ids; clear stale pause flags
      this.launch(t, contacts.length, opts.demo ?? false);
    }
    return threads;
  }

  /** The user accepted the price a thread was holding: close the deal. */
  approve(threadId: string): Thread {
    const { repo } = this.d;
    const t = repo.getThread(threadId);
    if (!t) throw new RunnerError("Thread not found", "not_found");
    if (t.status !== "awaiting_approval") throw new RunnerError(`Nothing to approve: the thread is ${t.status}`, "conflict");
    const want = repo.getWant(t.wantId);
    if (!want || want.status !== "open") throw new RunnerError("This want has already been purchased", "conflict");
    try {
      approveThread(t, want, { ...(this.d.now ? { now: this.d.now } : {}), onMessage: (th, m) => repo.addMessage(th.id, m) });
    } catch {
      throw new RunnerError("That price is no longer within your budget", "conflict");
    }
    repo.saveThread(t);
    repo.createDeal(t);
    return t;
  }

  /** The user turned the held price down. */
  decline(threadId: string): Thread {
    const { repo } = this.d;
    const t = repo.getThread(threadId);
    if (!t) throw new RunnerError("Thread not found", "not_found");
    if (t.status !== "awaiting_approval") throw new RunnerError(`Nothing to decline: the thread is ${t.status}`, "conflict");
    declineThread(t, { ...(this.d.now ? { now: this.d.now } : {}), onMessage: (th, m) => repo.addMessage(th.id, m) });
    repo.saveThread(t);
    return t;
  }

  pause(threadId: string): Thread {
    const t = this.d.repo.getThread(threadId);
    if (!t) throw new RunnerError("Thread not found", "not_found");
    if (t.status !== "negotiating") throw new RunnerError(`Cannot pause a thread that is ${t.status}`, "conflict");
    this.paused.add(threadId);
    const live = this.live.get(threadId);
    const target = live ?? t;
    target.status = "paused";
    this.d.repo.saveThread(target);
    return target;
  }

  resume(threadId: string): Thread {
    const t = this.live.get(threadId) ?? this.d.repo.getThread(threadId);
    if (!t) throw new RunnerError("Thread not found", "not_found");
    if (t.status !== "paused") throw new RunnerError(`Cannot resume a thread that is ${t.status}`, "conflict");
    this.paused.delete(threadId);
    t.status = "negotiating";
    this.d.repo.saveThread(t);
    if (!this.running.has(threadId)) this.launch(t, this.d.repo.listSellers(t.wantId).length);
    return t;
  }

  /**
   * End a thread because the want was bought elsewhere: stops its loop, tells the
   * seller truthfully, and records the reason.
   */
  withdraw(threadId: string, reason: WalkReason = "purchased_elsewhere"): void {
    const t = this.live.get(threadId) ?? this.d.repo.getThread(threadId);
    if (!t || t.status === "walked_away") return;
    this.halt(threadId);
    const msg = {
      from: "buyer" as const,
      text: "Thank you for your time. My user has bought this item elsewhere, so I'm withdrawing from this negotiation.",
      at: (this.d.now ?? Date.now)(),
      price: null,
    };
    t.messages.push(msg);
    this.d.repo.addMessage(t.id, msg);
    t.status = "walked_away";
    t.reason = reason;
    this.d.repo.saveThread(t);
  }

  /** On boot: threads left "negotiating" by a previous process become paused. */
  recoverInterrupted(): number {
    let n = 0;
    for (const t of this.d.repo.listThreads()) {
      if (t.status === "negotiating" && !this.running.has(t.id)) {
        t.status = "paused";
        this.d.repo.saveThread(t);
        n++;
      }
    }
    return n;
  }

  /** Resolves when no negotiation loop is active (used by tests and scripts). */
  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.allSettled([...this.running.values()]);
  }

  private halt(threadId: string): void {
    this.paused.add(threadId);
    const live = this.live.get(threadId);
    if (live && live.status === "negotiating") live.status = "paused";
  }

  private launch(thread: Thread, comparing: number, demo = false): void {
    const { repo } = this.d;
    const contact = repo.listSellers(thread.wantId).find((c) => c.id === thread.sellerId);
    const want = repo.getWant(thread.wantId);
    if (!contact || !want) return;
    const seller = this.d.sellerFor(contact, thread.lastAsk, demo);
    const deps: EngineDeps = {
      llm: demo ? null : this.d.llm,
      comparing,
      ...(this.d.now ? { now: this.d.now } : {}),
      onMessage: (t, m) => {
        repo.addMessage(t.id, m);
        repo.saveThread(t);
      },
    };
    this.live.set(thread.id, thread);
    const sleep = this.d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const loop = async (): Promise<void> => {
      await Promise.resolve(); // yield so the registration below always precedes cleanup
      try {
        for (let i = 0; i < (this.d.maxSteps ?? 20) && thread.status === "negotiating"; i++) {
          if (this.paused.has(thread.id)) {
            thread.status = "paused";
            break;
          }
          await step(thread, want, seller, deps);
          repo.saveThread(thread);
          if (statusOf(thread) === "deal") repo.createDeal(thread);
          const delay = demo ? 0 : (this.d.stepDelayMs ?? 0);
          if (delay > 0 && statusOf(thread) === "negotiating") await sleep(delay);
        }
      } catch (err) {
        // Fail safe: an unexpected error pauses the thread rather than guessing.
        thread.status = "paused";
        thread.detail = `Stopped by an error: ${err instanceof Error ? err.message : String(err)}`;
        this.d.log?.(`negotiation ${thread.id} failed`, err);
      } finally {
        repo.saveThread(thread);
        this.running.delete(thread.id);
        this.live.delete(thread.id);
      }
    };
    this.running.set(thread.id, loop());
  }
}
