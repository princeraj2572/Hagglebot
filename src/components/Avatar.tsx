/** Who is who in a chat: Hagglebot is a blue rounded square, sellers are yellow circles. */
const TAGLINE: Record<string, string> = {
  "Fast Ferdi": "Quick to close",
  "Firm Fatima": "Won't budge",
  "Chatty Chen": "Loves to talk",
  "Shady Sam": "Watch the fees",
};

export const tagline = (name: string): string => TAGLINE[name] ?? "Simulated seller";

const SIZE = { sm: "h-5 w-5 text-[10px]", md: "h-8 w-8 text-sm", lg: "h-11 w-11 text-lg" } as const;

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE }) {
  const bot = name === "Hagglebot";
  // Two letters of the persona name ("Fe", "Fa", "Ch", "Sa") so sellers sharing an initial stay distinct.
  const word = name.trim().split(/\s+/).at(-1) ?? "?";
  const letter = word.charAt(0).toUpperCase() + word.slice(1, 2).toLowerCase();
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center font-bold ${SIZE[size]} ${
        bot ? "rounded-md bg-ultra text-white" : "rounded-full border border-tag bg-tag/40 text-ink"
      }`}
    >
      {bot ? "H" : letter}
    </span>
  );
}
