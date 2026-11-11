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
  { title: "Pay, or ask first", text: "A deal inside your budget appears under Deals. Pay with PayPal (sandbox) and Hagglebot sends the seller the proof and withdraws from the other sellers. Turn on 'Ask me before accepting a price' to approve each deal yourself." },
];

/** The empty dashboard: a few ready-made things to try and a short walkthrough. */
export function Landing({ onStart }: { onStart?: ((preset?: Preset) => void) | undefined }) {
  const [tour, setTour] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      <section aria-label="Welcome" className="rounded-xl border border-line bg-paper p-7 text-ink sm:p-9">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">What do you want to buy?</h2>
        <p className="mt-3 max-w-lg leading-relaxed text-muted">Add a want and Hagglebot finds sellers, negotiates and pays. Everything is simulated.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {onStart && (
            <button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-transform duration-150 active:scale-[0.98] [@media(hover:hover)]:hover:bg-[#2A2A2A]" onClick={() => onStart()}>
              Add your first want
            </button>
          )}
          <button className="rounded-lg px-4 py-2.5 text-sm font-medium transition-transform duration-150 active:scale-[0.98] border border-line bg-paper text-ink [@media(hover:hover)]:hover:bg-mist" onClick={() => setTour(0)}>
            Take the 1-minute tour
          </button>
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
                className="flex h-full w-full flex-col rounded-xl bg-paper p-5 text-left shadow-lift transition-[transform,box-shadow] duration-150 active:scale-[0.98] [@media(hover:hover)]:hover:-translate-y-0.5"
              >
                <span className="w-fit rounded-md bg-mist px-2.5 py-0.5 text-[12px] font-semibold text-muted">{u.tag}</span>
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
                <span key={i} className={`h-1 flex-1 rounded-full ${i <= tour ? "bg-ink" : "bg-mist"}`} />
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
              <button className="rounded-md px-4 py-2 text-sm font-semibold text-muted disabled:opacity-40" disabled={tour === 0} onClick={() => setTour(tour - 1)}>
                Back
              </button>
              {tour < STEPS.length - 1 ? (
                <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white [@media(hover:hover)]:hover:bg-[#2A2A2A]" onClick={() => setTour(tour + 1)}>
                  Next
                </button>
              ) : (
                <button
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white [@media(hover:hover)]:hover:bg-[#2A2A2A]"
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
