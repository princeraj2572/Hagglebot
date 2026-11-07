"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Preset } from "./Landing";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True once the element has scrolled into view (and stays true). Always true when the visitor asked for less motion. */
function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

const t = (delay = 0): CSSProperties => ({ transitionDelay: `${delay}ms` });
const MOVE = "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none";

// One negotiation, replayed: the seller's ask falls and Hagglebot's offer rises until they meet.
const ASKS = [399, 330, 268, 225];
const OFFERS = [175, 190, 208, 225];
const BUDGET = 250;
const pct = (price: number) => ((price - 150) / (420 - 150)) * 100;

function Replay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced()) {
      setStep(ASKS.length - 1);
      return;
    }
    const id = setInterval(() => setStep((s) => (s + 1) % (ASKS.length + 2)), 1500);
    return () => clearInterval(id);
  }, []);
  const i = Math.min(step, ASKS.length - 1);
  const done = step >= ASKS.length - 1;
  return (
    <figure aria-label="Example negotiation" className="rounded-xl border border-line bg-paper p-6 shadow-lift">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Headphones</span>
        <span className="num text-muted">budget ${BUDGET}</span>
      </figcaption>
      <div className="relative mt-10 h-16" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ultra/15 transition-[left,width] duration-700 ease-out motion-reduce:transition-none"
          style={{ left: `${pct(OFFERS[i]!)}%`, width: `${pct(ASKS[i]!) - pct(OFFERS[i]!)}%` }}
        />
        <div className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${pct(BUDGET)}%` }} />
        {[
          { price: ASKS[i]!, color: "bg-tag" },
          { price: OFFERS[i]!, color: "bg-ultra" },
        ].map((d, k) => (
          <span key={k} className="absolute top-1/2 transition-[left] duration-700 ease-out motion-reduce:transition-none" style={{ left: `${pct(d.price)}%` }}>
            <i className={`absolute left-0 top-0 block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${d.color} ${done ? "ring-4 ring-ink/10" : ""}`} />
            <span className="num absolute left-0 top-4 -translate-x-1/2 text-xs text-ink">${d.price}</span>
          </span>
        ))}
      </div>
      <p role="status" className="mt-6 min-h-[2.75rem] text-sm leading-relaxed text-muted">
        {done ? (
          <>
            <span className="font-medium text-ink">Deal at $225</span>, $25 under budget. The seller never saw the budget.
          </>
        ) : (
          <>
            Seller asks <span className="num text-ink">${ASKS[i]}</span>. Hagglebot offers <span className="num text-ink">${OFFERS[i]}</span>.
          </>
        )}
      </p>
    </figure>
  );
}

/** The product's own picture: a price scale. Right of the budget line is hatched, because Hagglebot never goes there. */
function PriceRuler() {
  const [ref, seen] = useInView<HTMLElement>();
  const marks = [200, 300, 350, 400];
  return (
    <section ref={ref} aria-label="Your budget is a hard limit" className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <p className="mb-4 max-w-md text-sm text-muted">Your budget is a hard limit. Hagglebot never goes past it, and the seller never sees it.</p>
      <div className="relative h-20 overflow-hidden rounded-lg border border-line bg-paper">
        <div
          aria-hidden
          className={`absolute inset-y-0 right-0 origin-left ${seen ? "scale-x-100" : "scale-x-0"} transition-transform duration-[1100ms] ease-out motion-reduce:transition-none`}
          style={{ left: `${pct(BUDGET)}%`, backgroundImage: "repeating-linear-gradient(135deg, rgba(200,40,60,.22) 0 1px, transparent 1px 9px)", ...t(400) }}
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-3" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(13,15,20,.3) 0 1px, transparent 1px 12px)", backgroundSize: "100% 6px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" }} />
        {marks.map((m) => (
          <span key={m} className={`num absolute bottom-5 -translate-x-1/2 text-xs text-muted ${MOVE} ${seen ? "opacity-100" : "opacity-0"}`} style={{ left: `${pct(m)}%`, ...t(300) }}>
            ${m}
          </span>
        ))}
        <span aria-hidden className={`absolute inset-y-0 w-px origin-top bg-ink ${seen ? "scale-y-100" : "scale-y-0"} transition-transform duration-500 ease-out motion-reduce:transition-none`} style={{ left: `${pct(BUDGET)}%` }} />
        <span className={`absolute top-2.5 text-xs font-medium ${MOVE} ${seen ? "opacity-100" : "opacity-0"}`} style={{ left: `calc(${pct(BUDGET)}% + 8px)`, ...t(300) }}>
          Your budget
        </span>
        <span className={`absolute right-3 top-2.5 text-xs text-scam ${MOVE} ${seen ? "opacity-100" : "opacity-0"}`} style={t(1000)}>
          Never goes here
        </span>
      </div>
    </section>
  );
}

const STEPS = [
  ["Say what you want", "An item, the most you will pay, and how hard to push."],
  ["Hagglebot works the room", "It talks to every seller at once. Every offer comes with a reason, and scams are refused."],
  ["You pick the deal", "The best price inside your budget is ready to pay, or approve each deal yourself first."],
] as const;

/** The first thing a new visitor sees. A quick way in (what and how much), or straight on to the dashboard. */
export function Hero({ onStart, onContinue }: { onStart: (preset: Preset) => void; onContinue: () => void }) {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const field = "min-w-0 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-ultra focus:ring-2 focus:ring-ultra/20";
  // The load sequence: each piece rises in turn, once, and not at all for anyone who asked for less motion.
  const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
  const R = "motion-safe:animate-rise";
  return (
    <div className="min-h-screen bg-chalk text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6 sm:px-8">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">H</span>
          Hagglebot
        </span>
        <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted [@media(hover:hover)]:hover:bg-mist [@media(hover:hover)]:hover:text-ink" onClick={onContinue}>
          Open the dashboard
        </button>
      </header>

      <main className="mx-auto grid max-w-5xl items-center gap-14 px-5 pb-4 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
            <span className="block overflow-hidden pb-1">
              <span className={`block ${R}`} style={rise(0)}>Stop paying</span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span className={`block ${R}`} style={rise(100)}>the first price.</span>
            </span>
          </h1>
          <p className={`mt-5 max-w-md text-lg leading-relaxed text-muted ${R}`} style={rise(260)}>
            Tell Hagglebot what you want and the most you will pay. It haggles with every seller at once.
          </p>

          <form
            className={`mt-8 max-w-md ${R}`}
            style={rise(380)}
            onSubmit={(e) => {
              e.preventDefault();
              if (item.trim()) onStart({ item: item.trim(), maxPrice: price, notes: "" });
            }}
          >
            <div className="flex gap-2">
              <input aria-label="What do you want?" className={`${field} flex-1`} placeholder="What do you want?" value={item} onChange={(e) => setItem(e.target.value)} />
              <input aria-label="Most you will pay, in dollars" inputMode="numeric" className={`${field} num w-24`} placeholder="Max $" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
            </div>
            <button
              type="submit"
              disabled={!item.trim()}
              className="mt-3 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40 [@media(hover:hover)]:hover:enabled:bg-[#2A2E37]"
            >
              Start haggling
            </button>
            <p className="mt-4 text-sm text-muted">Sellers, negotiation and payments are simulated. No account, no real money.</p>
          </form>
        </div>

        <div className={R} style={rise(300)}>
          <Replay />
        </div>
      </main>

      <PriceRuler />

      <section aria-label="How it works" className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <ol className="grid gap-10 border-t border-line pt-10 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span className="num text-sm text-muted">0{i + 1}</span>
              <p className="mt-2 font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
          <span>Always says it is an AI. Your budget is never shown to a seller.</span>
          <button className="rounded-lg bg-ink px-4 py-2 font-medium text-white [@media(hover:hover)]:hover:bg-[#2A2E37]" onClick={onContinue}>
            Open the dashboard
          </button>
        </div>
      </section>
    </div>
  );
}
