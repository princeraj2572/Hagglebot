"use client";
import { useState } from "react";
import { Modal } from "./Modal";

export interface Preset {
  item: string;
  maxPrice: string;
  notes: string;
}

const USE_CASES: { title: string; blurb: string; tag: string; preset: Preset }[] = [
  { title: "Headphones under $250", blurb: "Several shops, one budget. See who drops the price and who hides a fee.", tag: "Most popular", preset: { item: "Wireless noise-cancelling headphones", maxPrice: "250", notes: "" } },
  { title: "A used laptop", blurb: "Listings show their condition, so you can haggle on refurbished and used too.", tag: "New or used", preset: { item: "Laptop", maxPrice: "600", notes: "Used or refurbished is fine" } },
  { title: "A desk setup", blurb: "Add a monitor, keyboard and webcam, then share one total budget across them.", tag: "Bundles", preset: { item: "27-inch monitor with USB-C", maxPrice: "400", notes: "" } },
  { title: "Something small", blurb: "A quick win: a mouse or a charger, negotiated and paid in under a minute.", tag: "Quick try", preset: { item: "Wireless mouse", maxPrice: "40", notes: "" } },
];

const STEPS = [
  { title: "Say what you want", text: "Type the item and the most you would pay. Pick how hard to haggle: patient, balanced or quick. Your budget is never shown to a seller." },
  { title: "Let it find sellers", text: "With 'Find sellers and negotiate for me' ticked, Hagglebot searches the marketplace, adds the best offers and starts. Or open the Marketplace tab, check each listing's condition and negotiate the ones you like." },
  { title: "Watch it negotiate", text: "Every seller is a live conversation. The price scale shows each ask and offer, and a note beside a message explains the rule that shaped it. Some sellers will try to scam you: Hagglebot walks away." },
  { title: "Pay, or ask first", text: "A deal inside your budget appears under Deals. Confirm and Pay completes a mock payment and withdraws from the other sellers. Turn on 'Ask me before accepting a price' to approve each deal yourself." },
];

const RULER = {
  backgroundImage:
    "repeating-linear-gradient(90deg, rgba(255,255,255,.22) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 1px, transparent 1px 12px)",
  backgroundSize: "100% 14px, 100% 7px",
  backgroundRepeat: "no-repeat",
  maskImage: "linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)",
  WebkitMaskImage: "linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)",
} as const;

/** The first screen: what Hagglebot does, a few ready-made things to try, and a short walkthrough. */
export function Landing({ onStart }: { onStart?: ((preset?: Preset) => void) | undefined }) {
  const [tour, setTour] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      <section aria-label="Welcome" className="relative isolate overflow-hidden rounded-[28px] bg-ink p-7 text-white shadow-lift sm:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 opacity-60" style={RULER} />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 -z-10 h-96 w-96 rounded-full bg-ultra/45 blur-3xl" />

        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h2 className="max-w-2xl text-balance text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl">Stop paying the first price.</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/75">
              Tell Hagglebot what you want and the most you will pay. It talks to every seller at once, never goes over budget and walks away from scams.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {onStart && (
                <button className="rounded-full bg-white px-6 py-3 font-semibold text-ink transition-transform duration-150 active:scale-[0.97] [@media(hover:hover)]:hover:bg-tag" onClick={() => onStart()}>
                  Add your first want
                </button>
              )}
              <button
                className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition-transform duration-150 active:scale-[0.97] [@media(hover:hover)]:hover:bg-white/20"
                onClick={() => setTour(0)}
              >
                Take the 1-minute tour
              </button>
            </div>
            <p className="mt-4 text-sm text-white/55">Sellers, negotiation and payments are simulated. No account needed and no real money moves.</p>
          </div>

          {/* A frozen negotiation: the two prices closing in on each other under the budget line. */}
          <figure aria-label="Example negotiation" className="rounded-2xl bg-white/[0.07] p-5">
            <figcaption className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">Headphones, budget $250</span>
              <span className="text-white/55">example</span>
            </figcaption>
            <div className="relative mt-8 h-16" aria-hidden>
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
              <div className="absolute inset-y-0 left-[72%] w-px bg-white/60" />
              <span className="absolute -top-5 left-[72%] -translate-x-1/2 text-[11px] text-white/70">budget</span>
              {[
                ["12%", "$175", "bg-ultra"],
                ["44%", "$205", "bg-ultra"],
                ["58%", "$225", "bg-tag"],
                ["90%", "$399", "bg-tag"],
              ].map(([x, label, c]) => (
                <span key={label} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x }}>
                  <i className={`block h-3 w-3 rounded-full ${c}`} />
                  <span className="absolute left-1/2 top-4 -translate-x-1/2 text-[11px] text-white/70">{label}</span>
                </span>
              ))}
            </div>
            <ul className="mt-6 space-y-1.5 text-sm text-white/75">
              <li><span className="mr-2 inline-block h-2 w-2 rounded-full bg-tag" />the seller opens at $399</li>
              <li><span className="mr-2 inline-block h-2 w-2 rounded-full bg-ultra" />Hagglebot offers $175, then $205</li>
              <li><span className="mr-2 inline-block h-2 w-2 rounded-full bg-white" />they meet at $225, $25 under budget</li>
            </ul>
          </figure>
        </div>
      </section>

      <section aria-label="Things to try">
        <h3 className="px-1 text-lg font-semibold">Try one</h3>
        <p className="px-1 text-sm text-muted">Pick a starting point. You can change everything before it starts.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {USE_CASES.map((u) => (
            <li key={u.title}>
              <button
                onClick={() => onStart?.(u.preset)}
                disabled={!onStart}
                className="flex h-full w-full flex-col rounded-2xl bg-paper p-5 text-left shadow-lift transition-[transform,box-shadow] duration-150 active:scale-[0.98] [@media(hover:hover)]:hover:-translate-y-0.5"
              >
                <span className="w-fit rounded-full bg-mist px-2.5 py-0.5 text-[12px] font-semibold text-muted">{u.tag}</span>
                <span className="mt-3 font-semibold leading-snug">{u.title}</span>
                <span className="mt-1 text-sm leading-relaxed text-muted">{u.blurb}</span>
                <span className="mt-auto pt-4 text-sm font-semibold text-ultra">Start this</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Modal open={tour !== null} onClose={() => setTour(null)} title="How Hagglebot works">
        {tour !== null && (
          <div className="space-y-5">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i <= tour ? "bg-ultra" : "bg-mist"}`} />
              ))}
            </div>
            <div>
              <p className="text-sm text-muted">
                Step {tour + 1} of {STEPS.length}
              </p>
              <h4 className="mt-1 text-2xl font-bold tracking-tight">{STEPS[tour]!.title}</h4>
              <p className="mt-2 leading-relaxed text-muted">{STEPS[tour]!.text}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button className="rounded-full px-4 py-2 text-sm font-semibold text-muted disabled:opacity-40" disabled={tour === 0} onClick={() => setTour(tour - 1)}>
                Back
              </button>
              {tour < STEPS.length - 1 ? (
                <button className="rounded-full bg-ultra px-5 py-2 text-sm font-semibold text-white" onClick={() => setTour(tour + 1)}>
                  Next
                </button>
              ) : (
                <button
                  className="rounded-full bg-ultra px-5 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    setTour(null);
                    onStart?.();
                  }}
                >
                  Add your first want
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
