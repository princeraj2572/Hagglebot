/** Shared control styles, so every button and field has the same pressed, hover and focus behaviour. */
export const btn =
  "rounded-lg px-3.5 py-2 text-sm font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const primary = `${btn} bg-ink text-white [@media(hover:hover)]:hover:bg-[#2A2A2A]`;
export const ghost = `${btn} whitespace-nowrap border border-line bg-paper text-ink [@media(hover:hover)]:hover:bg-mist`;
export const input =
  "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm placeholder:text-muted focus:border-ultra focus:ring-2 focus:ring-ultra/20";
