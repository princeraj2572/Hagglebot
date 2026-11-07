"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Preset } from "./Landing";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// One product, three sellers, replayed: Ferdi comes down to a deal, Chen stays above the budget, Sam tries a fee and is refused.
const LIST = 399;
const FERDI = [399, 330, 268, 225];
const OFFERS = [175, 190, 208, 225];
const CHEN = [399, 360, 320, 285];
const BUDGET = 250;
const pct = (price: number) => ((price - 150) / (420 - 150)) * 100;

/** A small line drawing of the product being negotiated. */
function HeadphonesArt() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 29v-5a15 15 0 0130 0v5" />
      <rect x="6" y="28" width="9" height="13" rx="3.5" fill="#FED7AA" />
      <rect x="33" y="28" width="9" height="13" rx="3.5" fill="#FED7AA" />
    </svg>
  );
}

const STATUS: Record<string, string> = {
  Deal: "bg-[#E7F7EE] text-[#15803D]",
  Haggling: "bg-[#E8F0FE] text-[#2F63F3]",
  "Over budget": "bg-[#FEF3C7] text-[#92400E]",
  Scam: "bg-[#FDE8E4] text-[#B42318]",
};

function Replay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced()) {
      setStep(FERDI.length - 1);
      return;
    }
    const id = setInterval(() => setStep((s) => (s + 1) % (FERDI.length + 2)), 1500);
    return () => clearInterval(id);
  }, []);
  const i = Math.min(step, FERDI.length - 1);
  const done = step >= FERDI.length - 1;
  const rows = [
    { name: "Fast Ferdi", initials: "Fe", price: FERDI[i]!, status: done ? "Deal" : "Haggling" },
    { name: "Chatty Chen", initials: "Ch", price: CHEN[i]!, status: CHEN[i]! > BUDGET && done ? "Over budget" : "Haggling" },
    { name: "Shady Sam", initials: "Sa", price: i >= 2 ? null : 350 - i * 20, status: i >= 2 ? "Scam" : "Haggling" },
  ];
  return (
    <figure aria-label="Example negotiation" className="w-full max-w-[24rem] rounded-2xl border border-line bg-paper p-4 shadow-[0_20px_50px_-24px_rgba(47,99,243,0.35)] sm:p-5">
      <figcaption className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E6]">
          <HeadphonesArt />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">Noise-cancelling headphones</span>
          <span className="num block text-xs text-muted">Listed ${LIST} · your budget ${BUDGET}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#E7F7EE] px-2 py-1 text-[11px] font-medium text-[#15803D]">
          <i className="h-1.5 w-1.5 rounded-full bg-[#22C55E] motion-safe:animate-pulse" />
          Live
        </span>
      </figcaption>

      <div className="relative mt-6 h-12" aria-hidden>
        {/* right of the budget line is never entered */}
        <div className="absolute inset-y-0 right-0 rounded-r-md" style={{ left: `${pct(BUDGET)}%`, backgroundImage: "repeating-linear-gradient(135deg, rgba(205,87,53,.22) 0 1px, transparent 1px 8px)" }} />
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ultra/15 transition-[left,width] duration-700 ease-out motion-reduce:transition-none" style={{ left: `${pct(OFFERS[i]!)}%`, width: `${pct(FERDI[i]!) - pct(OFFERS[i]!)}%` }} />
        <div className="absolute inset-y-0 w-px bg-ink/60" style={{ left: `${pct(BUDGET)}%` }} />
        {[
          { price: FERDI[i]!, color: "bg-[#F5A524]" },
          { price: OFFERS[i]!, color: "bg-ultra" },
        ].map((d, k) => (
          <span key={k} className="absolute top-1/2 transition-[left] duration-700 ease-out motion-reduce:transition-none" style={{ left: `${pct(d.price)}%` }}>
            <i className={`absolute left-0 top-0 block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${d.color} ${done ? "ring-4 ring-ink/10" : ""}`} />
            <span className="num absolute left-0 top-4 -translate-x-1/2 text-[11px]">${d.price}</span>
          </span>
        ))}
      </div>

      <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2.5 px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5A524]/25 text-[11px] font-semibold">{r.initials}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors duration-300 ${STATUS[r.status]}`}>{r.status}</span>
            <span className="num w-12 text-right text-sm">{r.price === null ? "\u2014" : `$${r.price}`}</span>
          </li>
        ))}
      </ul>

      <p role="status" className="mt-4 flex min-h-[1.75rem] items-center justify-between gap-2 text-sm text-muted">
        {done ? (
          <>
            <span>
              <span className="font-semibold text-ink">Best deal $225</span>, $25 under budget
            </span>
            <span className="num rounded-md bg-[#E7F7EE] px-2 py-0.5 text-xs font-medium text-[#15803D]">saved ${LIST - 225}</span>
          </>
        ) : (
          <span>Comparing three sellers at once...</span>
        )}
      </p>
    </figure>
  );
}

/** A small coloured tile with a line icon, the way each feature is marked. */
function Tile({ color, d }: { color: string; d: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: color }} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

const ICON = {
  sliders: "M4 6h16M4 12h10M4 18h6",
  shield: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z",
  tag: "M3 12V4h8l10 10-8 8L3 12z M7.5 7.5h.01",
  chat: "M4 5h16v11H9l-5 4V5z",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 018 0v3",
  check: "M5 12l4 4 10-10",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8z M4 21a8 8 0 0116 0",
} as const;

/** The small tinted label above a section heading. */
function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-md bg-[#E8F0FE] px-2.5 py-1 text-xs font-medium text-[#2F63F3]">{children}</span>;
}

/** A floating tag, like a sticky note on the product picture. */
function Float({ className, color, children, delay = 0 }: { className: string; color: string; children: ReactNode; delay?: number }) {
  return (
    <span
      className={`absolute hidden items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-medium shadow-lift motion-safe:animate-float sm:inline-flex ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

const FEATURES = [
  ["#F97316", ICON.sliders, "Parallel negotiation", "Every seller at once, on one price scale."],
  ["#3B82F6", ICON.lock, "A hard budget ceiling", "Never shown to a seller. Never exceeded."],
  ["#EF4444", ICON.shield, "Scam protection", "Hidden fees and off-platform requests are refused."],
  ["#22C55E", ICON.tag, "Real listings, real condition", "New, used or refurbished, on every card."],
] as const;

const EXPLAINED = [
  ["#EC4899", ICON.chat, "Read every message"],
  ["#EAB308", ICON.check, "See why each price was offered"],
  ["#3B82F6", ICON.user, "Approve before it accepts"],
  ["#F97316", ICON.tag, "Share one budget across wants"],
  ["#22C55E", ICON.shield, "Download any transcript"],
] as const;

/** The first thing a new visitor sees. A quick way in (what and how much), or straight on to the dashboard. */
export function Hero({ onStart, onContinue }: { onStart: (preset: Preset) => void; onContinue: () => void }) {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const field = "min-w-0 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-ultra focus:ring-2 focus:ring-ultra/20";
  // The load sequence: each piece rises in turn, once, and not at all for anyone who asked for less motion.
  const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
  const R = "motion-safe:animate-rise";
  const black = "rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40 [@media(hover:hover)]:hover:enabled:bg-[#2A2A2A]";
  const outline = "rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-medium transition-transform duration-150 active:scale-[0.98] [@media(hover:hover)]:hover:bg-mist";
  return (
    <div className="min-h-screen bg-chalk text-ink">
      <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-5 sm:pt-4">
        <nav className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-2.5 shadow-lift">
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">H</span>
            Hagglebot
          </span>
          <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
            <li><a className="hover:text-ink" href="#features">Features</a></li>
            <li><a className="hover:text-ink" href="#explained">Transparency</a></li>
            <li><a className="hover:text-ink" href="#start">Start</a></li>
          </ul>
          <button className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white [@media(hover:hover)]:hover:bg-[#2A2A2A]" onClick={onContinue}>
            Open dashboard
          </button>
        </nav>

        <main className="mt-3 rounded-[28px] border border-line bg-paper p-3 sm:mt-4 sm:p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
            <div className="flex flex-col p-4 sm:p-8">
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border border-line bg-chalk px-2.5 py-1 text-xs ${R}`} style={rise(0)}>
                <span aria-hidden className="flex -space-x-1.5">
                  {["#F97316", "#3B82F6", "#EC4899"].map((c) => (
                    <i key={c} className="block h-4 w-4 rounded-full border-2 border-chalk" style={{ background: c }} />
                  ))}
                </span>
                14 simulated sellers. No real money.
              </span>
              <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[3.4rem]">
                <span className="block overflow-hidden pb-1">
                  <span className={`block ${R}`} style={rise(60)}>Stop paying</span>
                </span>
                <span className="block overflow-hidden pb-1">
                  <span className={`block ${R}`} style={rise(160)}>the first price.</span>
                </span>
              </h1>
              <p className={`mt-4 max-w-sm text-[15px] leading-relaxed text-muted ${R}`} style={rise(280)}>
                Tell Hagglebot what you want and the most you will pay. It haggles with every seller at once, and walks away from scams.
              </p>

              <form
                id="start"
                className={`mt-6 max-w-md ${R}`}
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" disabled={!item.trim()} className={black}>Start haggling</button>
                  <button type="button" onClick={onContinue} className={outline}>Explore the dashboard</button>
                </div>
              </form>

              <div className={`mt-10 sm:mt-auto sm:pt-10 ${R}`} style={rise(520)}>
                <p className="num text-4xl font-semibold tracking-tight text-[#CD5735]">$0</p>
                <p className="mt-1 max-w-[16rem] text-sm text-muted">Real money moved. Sellers, negotiation and payments are all simulated.</p>
              </div>
            </div>

            <div className={`relative flex min-h-[34rem] items-center justify-center overflow-hidden rounded-2xl bg-chalk p-4 sm:p-8 ${R}`} style={rise(200)}>
              <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#7FA8FF_0%,#B9CFFF_45%,transparent_70%)] opacity-70 blur-2xl motion-safe:animate-float" />
              <Replay />
              <Float className="left-3 top-5" color="#F97316" delay={0}>Budget never shown</Float>
              <Float className="right-3 top-12" color="#EF4444" delay={1.2}>Hidden fee refused</Float>
              <Float className="bottom-6 left-4" color="#22C55E" delay={2.4}>Saved $25</Float>
              <Float className="bottom-12 right-3" color="#3B82F6" delay={3.4}>Walked away from Sam</Float>
            </div>
          </div>
        </main>

        <section id="features" className="mx-auto grid max-w-5xl items-center gap-10 px-2 py-24 lg:grid-cols-2">
          <div>
            <Chip>Core features</Chip>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A smarter way to buy anything.</h2>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">Hagglebot does the back and forth, keeps your budget safe and shows you the result.</p>
            <button className={`mt-6 ${black}`} onClick={onContinue}>Open dashboard</button>
          </div>
          <div className="relative rounded-2xl bg-mist p-4 sm:p-6">
            <ul className="space-y-2.5 rounded-xl border border-line bg-paper p-3 shadow-lift">
              {FEATURES.map(([color, d, title, text]) => (
                <li key={title} className="flex items-center gap-3 rounded-lg border border-line bg-chalk/60 p-3">
                  <Tile color={color} d={d} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="truncate text-xs text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Float className="-left-3 top-6" color="#3B82F6" delay={0.6}>Budget kept</Float>
            <Float className="-right-3 bottom-8" color="#EF4444" delay={1.8}>Scam found</Float>
          </div>
        </section>

        <section id="explained" className="mx-auto grid max-w-5xl items-center gap-10 px-2 pb-24 lg:grid-cols-2">
          <div className="rounded-2xl bg-mist p-4 sm:p-6">
            <div className="space-y-3 rounded-xl border border-line bg-paper p-4 text-sm shadow-lift">
              <p className="max-w-[85%] rounded-xl rounded-bl-sm bg-chalk px-3.5 py-2.5">Deal at $210. A $30 processing fee applies, and easiest is to pay me directly, off the platform.</p>
              <p className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-ultra px-3.5 py-2.5 text-white">I only pay through this platform, and agreed prices include everything. I will step away from this one.</p>
              <p className="flex items-center gap-2 text-xs text-muted">
                <i className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
                Guardrail: hidden fee and off-platform payment detected. Walked away.
              </p>
            </div>
          </div>
          <div>
            <Chip>Transparency</Chip>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Conversations that explain themselves.</h2>
            <ul className="mt-6 space-y-3">
              {EXPLAINED.map(([color, d, label]) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <Tile color={color} d={d} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-2 pb-20 text-center">
          <Chip>Try it</Chip>
          <h2 className="mx-auto mt-4 max-w-md text-balance text-3xl font-semibold tracking-tight sm:text-4xl">See what it saves you in a minute.</h2>
          <button className={`mt-6 ${black}`} onClick={onContinue}>Open dashboard</button>
          <p className="mt-10 text-xs text-muted">Hagglebot always says it is an AI. Your budget is never shown to a seller. Simulation only.</p>
        </section>
      </div>
    </div>
  );
}
