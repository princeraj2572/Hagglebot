import { tintFor } from "./tints";

/** Who is who in a chat: Hagglebot is a blue rounded square, sellers are yellow circles. */
const TAGLINE: Record<string, string> = {
  "Fast Ferdi": "Quick to close",
  "Firm Fatima": "Won't budge",
  "Chatty Chen": "Loves to talk",
  "Shady Sam": "Watch the fees",
  "Bargain Bea": "Fair back-and-forth",
  "Techy Tomas": "Knows the specs",
  "Sketchy Sasha": "Only good today",
  "Lazy Leo": "Whatever works",
  "Polite Priya": "Small careful steps",
  "Grumpy Gus": "Short on patience",
  "Collector Clara": "Proud of condition",
  "Wholesale Wei": "Bulk and quick",
  "Cash-Only Carl": "Prefers transfers",
  "Neighbor Nina": "Friendly local",
};

/** "Shady Sam 2" is the second Shady Sam: look up the personality by the name without the number. */
const baseName = (name: string): string => name.replace(/\s+\d+$/, "");

export const tagline = (name: string): string => TAGLINE[baseName(name)] ?? "Simulated seller";

const SIZE = { sm: "h-5 w-5 text-[10px]", md: "h-8 w-8 text-sm", lg: "h-11 w-11 text-lg" } as const;

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE }) {
  const bot = name === "Hagglebot";
  // Two letters of the persona name ("Fe", "Fa", "Ch", "Sa") so sellers sharing an initial stay distinct.
  const word = baseName(name.trim()).split(/\s+/).at(-1) ?? "?";
  const letter = word.charAt(0).toUpperCase() + word.slice(1, 2).toLowerCase();
  const tint = tintFor(name);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center font-bold ${SIZE[size]} ${bot ? "rounded-md bg-ultra text-white" : "rounded-full"}`}
      style={bot ? undefined : { background: tint.bg, color: tint.fg }}
    >
      {bot ? "H" : letter}
    </span>
  );
}
