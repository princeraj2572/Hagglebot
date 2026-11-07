/** Soft background + readable text pairs. A seller keeps the same colour on every screen, picked from its name. */
export const TINTS = [
  { bg: "#FFE9D6", fg: "#B4530A" }, // orange
  { bg: "#DCF5E4", fg: "#15803D" }, // green
  { bg: "#FCE3F0", fg: "#BE185D" }, // pink
  { bg: "#E9E2FF", fg: "#6D4AE0" }, // violet
  { bg: "#D8F3F3", fg: "#0F766E" }, // teal
  { bg: "#FDF0C2", fg: "#8A6100" }, // amber
  { bg: "#DDEBFF", fg: "#1D4ED8" }, // sky
  { bg: "#FFDFE0", fg: "#B42318" }, // rose
] as const;

export function tintFor(name: string) {
  const base = name.replace(/\s+\d+$/, ""); // "Shady Sam 2" keeps Shady Sam's colour
  let h = 0;
  for (const ch of base) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TINTS[h % TINTS.length]!;
}
