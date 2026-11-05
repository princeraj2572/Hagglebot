/** Shared control styles, so every button and field has the same pressed, hover and focus behaviour. */
export const btn =
  "rounded-md px-3 py-2 text-sm font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";
export const primary = `${btn} bg-ultra text-white [@media(hover:hover)]:hover:bg-[#2335b8]`;
export const ghost = `${btn} whitespace-nowrap border border-line [@media(hover:hover)]:hover:border-ink`;
export const input =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm placeholder:text-muted focus:border-ultra focus:ring-2 focus:ring-ultra/20";
