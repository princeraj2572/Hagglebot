"use client";
import { useEffect, useState } from "react";
import type { Preset } from "./Landing";

const RULER = {
  backgroundImage:
    "repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 1px, transparent 1px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 1px, transparent 1px 16px)",
  backgroundSize: "100% 18px, 100% 9px",
  backgroundRepeat: "no-repeat",
  maskImage: "linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)",
  WebkitMaskImage: "linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)",
} as const;

// One frozen-in-time negotiation, replayed: the seller's ask falls and Hagglebot's offer rises until they meet.
const ASKS = [399, 330, 268, 225];
const OFFERS = [175, 190, 208, 225];
const BUDGET = 250;
const pct = (price: number) => ((price - 150) / (420 - 150)) * 100;

function Replay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(ASKS.length - 1);
      return;
    }
    const id = setInterval(() => setStep((s) => (s + 1) % (ASKS.length + 1)), 1500);
    return () => clearInterval(id);
  }, []);
  const i = Math.min(step, ASKS.length - 1);
  const done = step >= ASKS.length - 1;
  return (
    <figure aria-label="Example negotiation" className="rounded-3xl bg-white/[0.07] p-6 backdrop-blur-sm">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">Headphones, budget ${BUDGET}</span>
        <span className="text-white/55">example</span>
      </figcaption>
      <div className="relative mt-10 h-20" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
        <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: `${pct(BUDGET)}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 text-[11px] text-white/70" style={{ left: `${pct(BUDGET)}%` }}>
          budget
        </span>
        {[
          { price: ASKS[i]!, color: "bg-tag", label: "ask" },
          { price: OFFERS[i]!, color: "bg-ultra", label: "offer" },
        ].map((d) => (
          <span key={d.label} className="absolute top-1/2 transition-[left] duration-700 ease-out" style={{ left: `${pct(d.price)}%` }}>
            <i className={`absolute left-0 top-0 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${d.color} ${done ? "ring-4 ring-white/30" : ""}`} />
            <span className="num absolute left-0 top-4 -translate-x-1/2 text-xs font-semibold text-white/85">${d.price}</span>
          </span>
        ))}
      </div>
      <p role="status" className="mt-6 min-h-[3.5rem] text-sm leading-relaxed text-white/75">
        {done ? (
          <>
            <span className="font-semibold text-white">Deal at $225.</span> $25 under budget, and the seller never saw the budget.
          </>
        ) : (
          <>
            The seller asks <span className="num font-semibold text-tag">${ASKS[i]}</span>. Hagglebot offers{" "}
            <span className="num font-semibold text-white">${OFFERS[i]}</span>.
          </>
        )}
      </p>
    </figure>
  );
}

/** The first thing a new visitor sees. A quick way in (what and how much), or straight on to the dashboard. */
export function Hero({ onStart, onContinue }: { onStart: (preset: Preset) => void; onContinue: () => void }) {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const field = "w-full rounded-xl bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/70";
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-ink text-white">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-36 opacity-60" style={RULER} />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-ultra/45 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-ultra/20 blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
        <span className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-ultra text-sm font-bold">H</span>
          Hagglebot
        </span>
        <button className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 [@media(hover:hover)]:hover:bg-white/10" onClick={onContinue}>
          Skip to the dashboard
        </button>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-balance text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">Stop paying the first price.</h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
            Tell Hagglebot what you want and the most you will pay. It talks to every seller at once, never goes over budget and walks away from scams.
          </p>

          <form
            className="mt-9 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (item.trim()) onStart({ item: item.trim(), maxPrice: price, notes: "" });
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input aria-label="What do you want?" className={`${field} sm:flex-1`} placeholder="What do you want? e.g. a standing desk" value={item} onChange={(e) => setItem(e.target.value)} />
              <input aria-label="Most you will pay, in dollars" inputMode="numeric" className={`${field} sm:w-32`} placeholder="Max $" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!item.trim()}
                className="rounded-full bg-white px-6 py-3 font-semibold text-ink transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 [@media(hover:hover)]:hover:enabled:bg-tag"
              >
                Haggle for me
              </button>
              <button
                type="button"
                onClick={onContinue}
                className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition-transform duration-150 active:scale-[0.97] [@media(hover:hover)]:hover:bg-white/20"
              >
                Continue to the dashboard
              </button>
            </div>
          </form>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/65">
            <li>Always says it is an AI</li>
            <li>Budget never shown to sellers</li>
            <li>Walks away from scams</li>
          </ul>
          <p className="mt-3 text-sm text-white/50">Sellers, negotiation and payments are simulated. No account, no real money.</p>
        </div>

        <Replay />
      </main>
    </div>
  );
}
