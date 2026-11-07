/** Shared control styles, so every button and field has the same pressed, hover and focus behaviour. */
export const btn =
  "rounded-xl px-3.5 py-2 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";
export const primary = `${btn} bg-ultra text-white [@media(hover:hover)]:hover:bg-[#2335b8]`;
export const ghost = `${btn} whitespace-nowrap bg-mist text-ink [@media(hover:hover)]:hover:bg-[#DCE2EF]`;
export const input =
  "w-full rounded-xl border border-transparent bg-mist px-3.5 py-2.5 text-sm placeholder:text-muted focus:border-ultra focus:bg-paper focus:ring-2 focus:ring-ultra/20";
