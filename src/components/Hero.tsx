"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PERSONAS } from "@/lib/sellers/personas";
import { Avatar, tagline } from "./Avatar";
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

/** Counts up to a number once `on` is true. */
function useCount(target: number, on: boolean, ms = 1100): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (reduced()) {
      setN(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, target, ms]);
  return n;
}

/** A transition delay in ms. */
const t = (delay = 0): CSSProperties => ({ transitionDelay: `${delay}ms` });
const MOVE = "transition-[opacity,transform,left,width] duration-700 ease-out motion-reduce:transition-none";

// A slowly drifting ruler along the top edge: the page's one ambient motion.
const RULER: CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, rgba(255,255,255,.26) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
  backgroundSize: "64px 18px, 16px 9px",
  backgroundRepeat: "repeat-x",
  maskImage: "linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)",
  WebkitMaskImage: "linear-gradient(90deg, transparent, #000 20%, #000 80%, transparent)",
};

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
    <figure aria-label="Example negotiation" className="rounded-3xl bg-white/[0.07] p-6 shadow-[0_30px_80px_-30px_rgba(43,63,214,0.55)] backdrop-blur-sm">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">Headphones, budget ${BUDGET}</span>
        <span className="flex items-center gap-1.5 text-white/55">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-tag motion-safe:animate-pulse" />
          example
        </span>
      </figcaption>
      <div className="relative mt-10 h-20" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
        {/* the gap between the two prices, drawn as a bar that closes */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25 transition-[left,width] duration-700 ease-out motion-reduce:transition-none"
          style={{ left: `${pct(OFFERS[i]!)}%`, width: `${pct(ASKS[i]!) - pct(OFFERS[i]!)}%` }}
        />
        <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: `${pct(BUDGET)}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 text-[11px] text-white/70" style={{ left: `${pct(BUDGET)}%` }}>
          budget
        </span>
        {[
          { price: ASKS[i]!, color: "bg-tag" },
          { price: OFFERS[i]!, color: "bg-ultra" },
        ].map((d, k) => (
          <span key={k} className="absolute top-1/2 transition-[left] duration-700 ease-out motion-reduce:transition-none" style={{ left: `${pct(d.price)}%` }}>
            <i className={`absolute left-0 top-0 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${d.color} ${done ? "ring-4 ring-white/30" : ""}`} />
            {done && k === 0 && <i className="absolute left-0 top-0 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white motion-safe:animate-ping-once" />}
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
            The seller asks <span className="num font-semibold text-tag">${ASKS[i]}</span>. Hagglebot offers <span className="num font-semibold text-white">${OFFERS[i]}</span>.
          </>
        )}
      </p>
    </figure>
  );
}

/** The product's own picture: a price scale. Right of the budget flag is hatched, because Hagglebot never goes there. */
function PriceRuler() {
  const [ref, seen] = useInView<HTMLElement>();
  const marks = [200, 300, 350, 400];
  return (
    <section ref={ref} aria-label="Your budget is a hard limit" className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <div className="relative h-24 overflow-hidden rounded-2xl bg-white/[0.05]">
        <div
          aria-hidden
          className={`absolute inset-y-0 right-0 origin-left ${seen ? "scale-x-100" : "scale-x-0"} transition-transform duration-[1100ms] ease-out motion-reduce:transition-none`}
          style={{ left: `${pct(BUDGET)}%`, backgroundImage: "repeating-linear-gradient(135deg, rgba(200,40,60,.3) 0 2px, transparent 2px 10px)", ...t(500) }}
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-5" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 1px, transparent 1px 12px)", backgroundSize: "100% 8px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" }} />
        {marks.map((m, k) => (
          <span key={m} className={`num absolute bottom-6 -translate-x-1/2 text-xs text-white/55 ${MOVE} ${seen ? "opacity-100" : "opacity-0"}`} style={{ left: `${pct(m)}%`, ...t(200 + k * 120) }}>
            ${m}
          </span>
        ))}
        <span aria-hidden className={`absolute inset-y-0 w-0.5 origin-top bg-white ${seen ? "scale-y-100" : "scale-y-0"} transition-transform duration-500 ease-out motion-reduce:transition-none`} style={{ left: `${pct(BUDGET)}%` }} />
        <span
          className={`absolute top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-ink ${MOVE} ${seen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}
          style={{ left: `calc(${pct(BUDGET)}% + 8px)`, ...t(350) }}
        >
          Your budget
        </span>
        <span className={`absolute right-4 top-3 text-xs font-semibold text-white/75 ${MOVE} ${seen ? "opacity-100" : "opacity-0"}`} style={t(1200)}>
          Never goes here
        </span>
      </div>
    </section>
  );
}

/** Fourteen simulated sellers, honest and not. Slides slowly; sits still for anyone who asks for less motion. */
function Sellers() {
  const row = [...PERSONAS, ...PERSONAS];
  return (
    <section aria-label="The sellers" className="pb-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Meet the sellers.</h2>
        <p className="mt-3 max-w-lg text-white/65">Fourteen personalities, from quick to close deals to ones who hide fees. Every negotiation is a different mix.</p>
      </div>
      <div className="mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] motion-reduce:overflow-x-auto">
        <ul className="flex w-max gap-3 px-3 motion-safe:animate-marquee motion-safe:hover:[animation-play-state:paused]">
          {row.map((p, i) => (
            <li key={`${p.id}-${i}`} aria-hidden={i >= PERSONAS.length} className="flex w-60 shrink-0 items-center gap-3 rounded-2xl bg-white/[0.06] p-4">
              <Avatar name={p.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-sm text-white/60">{tagline(p.name)}</p>
                {p.hiddenFeeRate > 0 && <span className="mt-1 inline-block rounded-full bg-scam px-2 py-0.5 text-[11px] font-bold">Tries a hidden fee</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** What each step looks like, drawn with the product's own parts, and played once when it scrolls into view. */
function StepArt({ n, on }: { n: 1 | 2 | 3; on: boolean }) {
  if (n === 1)
    return (
      <div className="space-y-2" aria-hidden>
        <div className={`rounded-xl bg-white/10 px-3 py-2 text-sm text-white/85 ${MOVE} ${on ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`}>Wireless headphones</div>
        <div className="flex gap-2 text-sm">
          <span className={`num rounded-xl bg-white/10 px-3 py-2 text-white/85 ${MOVE} ${on ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`} style={t(250)}>Max $250</span>
          <span className={`rounded-xl bg-ultra px-3 py-2 font-semibold ${MOVE} ${on ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} style={t(500)}>Balanced</span>
        </div>
      </div>
    );
  if (n === 2)
    return (
      <div className="space-y-3 pt-1" aria-hidden>
        {[[18, 70], [30, 58], [22, 80], [40, 52]].map(([a, b], i) => (
          <div key={i} className="relative h-3">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
            <span className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-ultra ${MOVE}`} style={{ left: `${on ? a : 4}%`, ...t(i * 150) }} />
            <span className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-tag ${MOVE}`} style={{ left: `${on ? b : 94}%`, ...t(i * 150) }} />
          </div>
        ))}
      </div>
    );
  return (
    <div className={`relative mx-auto w-full max-w-[16rem] rounded-xl bg-paper px-4 py-3 text-ink ${MOVE} ${on ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-4 -rotate-3 opacity-0"}`} style={t(300)} aria-hidden>
      <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink" />
      <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-ink" />
      <p className="text-xs text-muted">Best price</p>
      <p className="num text-3xl font-bold leading-tight">$225</p>
      <p className="mt-1 border-t border-dashed border-ink/25 pt-2 text-xs text-muted">$25 under budget</p>
    </div>
  );
}

function Steps() {
  const [ref, seen] = useInView<HTMLOListElement>();
  return (
    <section aria-label="How it works">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Three steps, no haggling by you.</h2>
      <ol ref={ref} className="mt-8 grid gap-4 md:grid-cols-3">
        {(
          [
            [1, "Say what you want", "An item, the most you will pay, and how hard to push."],
            [2, "Hagglebot works the room", "It talks to every seller at once, with a reason behind each offer."],
            [3, "You pick the deal", "The best price inside your budget is ready to pay."],
          ] as const
        ).map(([n, title, text]) => (
          <li key={n} className="flex flex-col rounded-2xl bg-white/[0.06] p-6">
            <div className="flex h-28 items-center">
              <div className="w-full">
                <StepArt n={n} on={seen} />
              </div>
            </div>
            <p className="mt-5 text-lg font-semibold">{title}</p>
            <p className="mt-1 leading-relaxed text-white/65">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The scam chat plays out message by message when it scrolls into view. */
function ScamChat() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const show = (on: boolean) => `${MOVE} ${on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`;
  return (
    <div ref={ref} className="space-y-3 rounded-3xl bg-white/[0.06] p-5 text-sm">
      <p className={`max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 ${show(seen)}`}>
        Deal at $210. A small $30 processing fee applies, and easiest is to pay me directly, off the platform.
      </p>
      <p className={`ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ultra px-4 py-3 ${show(seen)}`} style={t(1000)}>
        I only pay through this platform and agreed prices include everything. I will step away from this one. Thank you for your time.
      </p>
      <p className={`flex items-center gap-2 text-white/65 ${show(seen)}`} style={t(2000)}>
        <span aria-hidden className={`h-2 w-2 rounded-full bg-scam ${seen ? "motion-safe:animate-pulse" : ""}`} />
        Guardrail: hidden fee and off-platform payment detected. Walked away.
      </p>
    </div>
  );
}

const CHIP = "rounded-full px-2.5 py-1 text-xs font-bold";

/** The light, uneven grid: the one place the page changes pace. Its pictures move into place on scroll. */
function Features() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const ceiling = useCount(250, seen);
  return (
    <section aria-label="Features" className="-mx-2 rounded-[36px] bg-chalk p-6 text-ink sm:-mx-6 sm:p-10">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built to be trusted with your budget.</h2>
      <div ref={ref} className="mt-8 grid gap-4 lg:grid-cols-6">
        <article className="rounded-3xl bg-paper p-6 shadow-lift lg:col-span-4">
          <h3 className="text-lg font-semibold">Parallel negotiation</h3>
          <p className="mt-1 max-w-md text-muted">Every seller at once on one price scale, so you see who is moving and who is stuck.</p>
          <div className="mt-6 space-y-3" aria-hidden>
            {[
              ["Ferdi", 22, 60, "Deal $225"],
              ["Chen", 30, 52, "Haggling"],
              ["Sam", 18, 78, "Scam"],
              ["Fatima", 36, 66, "Haggling"],
            ].map(([name, a, b, state], i) => (
              <div key={String(name)} className="flex items-center gap-3 text-sm">
                <span className="w-14 text-muted">{name}</span>
                <div className="relative h-3 flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
                  <span className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-ultra ${MOVE}`} style={{ left: `${seen ? a : 2}%`, ...t(i * 150) }} />
                  <span className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-tag ${MOVE}`} style={{ left: `${seen ? b : 96}%`, ...t(i * 150) }} />
                </div>
                <span className={`${CHIP} w-24 text-center ${MOVE} ${seen ? "opacity-100" : "opacity-0"} ${state === "Scam" ? "bg-scam text-white" : state === "Haggling" ? "bg-mist text-muted" : "bg-ultra text-white"}`} style={t(900 + i * 150)}>
                  {state}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl bg-ink p-6 text-white lg:col-span-2">
          <h3 className="text-lg font-semibold">A hard ceiling</h3>
          <p className="num mt-4 text-6xl font-bold tracking-tight">${ceiling}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/65">Never shown to a seller. Never exceeded, even in a bundle.</p>
        </article>

        <article className="rounded-3xl bg-paper p-6 shadow-lift lg:col-span-2">
          <h3 className="text-lg font-semibold">Real listings, real condition</h3>
          <p className="mt-1 text-sm text-muted">New, used or refurbished is on every card.</p>
          <div className="mt-4 flex flex-wrap gap-2" aria-hidden>
            {[["new", "bg-mist"], ["refurbished", "bg-tag"], ["used", "bg-tag"]].map(([label, bg], i) => (
              <span key={label} className={`${CHIP} ${bg} text-ink ${MOVE} ${seen ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} style={t(300 + i * 150)}>
                {label}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-3xl bg-paper p-6 shadow-lift lg:col-span-2">
          <h3 className="text-lg font-semibold">Bundles</h3>
          <p className="mt-1 text-sm text-muted">One total budget across several wants.</p>
          <div className="mt-4" aria-hidden>
            <div className="h-2 overflow-hidden rounded-full bg-mist">
              <div className={`h-full rounded-full bg-ultra ${MOVE}`} style={{ width: seen ? "62%" : "0%", ...t(300) }} />
            </div>
            <p className="num mt-2 text-sm text-muted">$372 of $600 used</p>
          </div>
        </article>

        <article className="rounded-3xl bg-paper p-6 shadow-lift lg:col-span-2">
          <h3 className="text-lg font-semibold">Approve before accepting</h3>
          <p className="mt-1 text-sm text-muted">Pause at a good price and decide yourself.</p>
          <div className="mt-4 flex gap-2" aria-hidden>
            <span className={`rounded-full bg-ultra px-4 py-1.5 text-sm font-semibold text-white ${MOVE} ${seen ? "scale-100 opacity-100" : "scale-90 opacity-0"}`} style={t(400)}>Approve $225</span>
            <span className="rounded-full bg-mist px-4 py-1.5 text-sm font-semibold text-muted">Decline</span>
          </div>
        </article>

        <article className="rounded-3xl bg-paper p-6 shadow-lift lg:col-span-6">
          <h3 className="text-lg font-semibold">Every move explained</h3>
          <p className="mt-1 max-w-xl text-muted">A guardrail note sits beside the message it shaped. Download any negotiation as a transcript.</p>
          <p className={`mt-4 flex items-start gap-2 rounded-xl bg-mist px-4 py-3 text-sm ${MOVE} ${seen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`} style={t(500)} aria-hidden>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ultra" />
            Guardrail: introduced itself as an AI agent, and kept the offer below the seller&apos;s last ask.
          </p>
        </article>
      </div>
    </section>
  );
}

/** The first thing a new visitor sees. A quick way in (what and how much), or straight on to the dashboard. */
export function Hero({ onStart, onContinue }: { onStart: (preset: Preset) => void; onContinue: () => void }) {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const field = "w-full rounded-xl bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/70";
  // The load sequence: each piece rises in turn. It plays once, and not at all for anyone who asked for less motion.
  const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
  const R = "motion-safe:animate-rise";
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-ink text-white">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-36 opacity-60 motion-safe:animate-drift" style={RULER} />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-ultra/45 blur-3xl motion-safe:animate-float" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-ultra/20 blur-3xl motion-safe:animate-float" style={{ animationDelay: "-6s" }} />

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
          <h1 className="text-balance text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            <span className="block overflow-hidden pb-1">
              <span className={`block ${R}`} style={rise(0)}>Stop paying</span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span className={`block ${R}`} style={rise(120)}>the first price.</span>
            </span>
          </h1>
          <p className={`mt-6 max-w-lg text-lg leading-relaxed text-white/75 ${R}`} style={rise(300)}>
            Tell Hagglebot what you want and the most you will pay. It talks to every seller at once, never goes over budget and walks away from scams.
          </p>

          <form
            className={`mt-9 max-w-xl ${R}`}
            style={rise(450)}
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

          <ul className={`mt-8 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/65 ${R}`} style={rise(600)}>
            <li>Always says it is an AI</li>
            <li>Budget never shown to sellers</li>
            <li>Walks away from scams</li>
          </ul>
          <p className={`mt-3 text-sm text-white/50 ${R}`} style={rise(650)}>Sellers, negotiation and payments are simulated. No account, no real money.</p>
        </div>

        <div className={R} style={rise(350)}>
          <Replay />
        </div>
      </main>

      <PriceRuler />
      <Sellers />

      <div className="mx-auto max-w-6xl space-y-24 px-5 pb-24 sm:px-8">
        <Steps />

        <section aria-label="Scam protection" className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">It walks away from scams.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/70">
              Some sellers add a hidden fee or ask you to pay outside the platform. Hagglebot spots the pattern, refuses and leaves, then tells you why.
            </p>
            <ul className="mt-5 space-y-2 text-white/80">
              <li>Hidden fees added after the price is agreed</li>
              <li>Requests to pay off-platform, by gift card or wire</li>
              <li>Pressure to decide now</li>
            </ul>
          </div>
          <ScamChat />
        </section>

        <Features />

        <section aria-label="Get started" className="relative isolate overflow-hidden rounded-3xl bg-ultra p-8 text-center sm:p-14">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 opacity-50 motion-safe:animate-drift" style={RULER} />
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">Ready to see it haggle?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">It takes under a minute, and nothing real is bought.</p>
          <button
            onClick={onContinue}
            className="mt-6 rounded-full bg-white px-7 py-3 font-semibold text-ink transition-transform duration-150 active:scale-[0.97] [@media(hover:hover)]:hover:bg-tag"
          >
            Continue to the dashboard
          </button>
        </section>
      </div>
    </div>
  );
}
