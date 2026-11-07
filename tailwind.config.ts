import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chalk: "#FAFAFB", // the canvas behind everything
        paper: "#FFFFFF", // working surfaces
        mist: "#F1F2F6", // quiet tonal fills (rails, table headers, inactive controls)
        ink: "#0E0D0D",
        muted: "#5A5855",
        line: "#E9EAEE",
        ultra: "#2F63F3", // Hagglebot: our offers and the pay action
        tag: "#F2B31B", // seller asks (price-tag yellow); fill only, never text
        scam: "#C8283C", // scams only
      },
      boxShadow: {
        // One lifted surface per screen (the conversation); everything else sits flat.
        lift: "0 1px 2px rgba(13,15,20,0.04), 0 10px 28px -18px rgba(13,15,20,0.16)",
      },
      keyframes: {
        "ping-once": { "0%": { transform: "scale(1)", opacity: "0.8" }, "100%": { transform: "scale(2.8)", opacity: "0" } },
        "tag-in": { "0%": { transform: "scale(0.6) rotate(-14deg)", opacity: "0" }, "100%": { transform: "scale(1) rotate(-2deg)", opacity: "1" } },
        typing: { "0%, 60%, 100%": { opacity: "0.3" }, "30%": { opacity: "1" } },
        "msg-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        rise: { from: { opacity: "0", transform: "translateY(110%)" }, to: { opacity: "1", transform: "none" } },
        drift: { from: { backgroundPosition: "0 0, 0 0" }, to: { backgroundPosition: "64px 0, 64px 0" } },
        float: { "0%, 100%": { transform: "translate(0, 0)" }, "50%": { transform: "translate(-24px, 18px)" } },
        "sheet-in": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } },
        "drawer-in": { from: { transform: "translateX(24px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
      },
      animation: {
        "ping-once": "ping-once 600ms ease-out 1 forwards",
        "tag-in": "tag-in 350ms cubic-bezier(0.34,1.56,0.64,1) 1 both",
        typing: "typing 1.2s ease-in-out infinite",
        "msg-in": "msg-in 220ms cubic-bezier(0.23,1,0.32,1) both",
        "fade-in": "fade-in 180ms ease-out both",
        marquee: "marquee 60s linear infinite",
        rise: "rise 800ms cubic-bezier(0.16, 1, 0.3, 1) both",
        drift: "drift 8s linear infinite",
        float: "float 14s ease-in-out infinite",
        "sheet-in": "sheet-in 240ms cubic-bezier(0.23,1,0.32,1) both",
        "drawer-in": "drawer-in 260ms cubic-bezier(0.23,1,0.32,1) both",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
