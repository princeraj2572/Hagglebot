import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chalk: "#F1F3F8", // the canvas behind everything
        paper: "#FFFFFF", // working surfaces
        mist: "#E8ECF4", // quiet tonal fills (rails, table headers, inactive controls)
        ink: "#0E1424",
        muted: "#586174",
        line: "#DCE1EB",
        ultra: "#2B3FD6", // Hagglebot: our offers and the pay action
        tag: "#F2B31B", // seller asks (price-tag yellow); fill only, never text
        scam: "#C8283C", // scams only
      },
      boxShadow: {
        // One lifted surface per screen (the conversation); everything else sits flat.
        lift: "0 1px 2px rgba(14,20,36,0.05), 0 18px 40px -24px rgba(14,20,36,0.28)",
      },
      keyframes: {
        "ping-once": { "0%": { transform: "scale(1)", opacity: "0.8" }, "100%": { transform: "scale(2.8)", opacity: "0" } },
        "tag-in": { "0%": { transform: "scale(0.6) rotate(-14deg)", opacity: "0" }, "100%": { transform: "scale(1) rotate(-2deg)", opacity: "1" } },
        typing: { "0%, 60%, 100%": { opacity: "0.3" }, "30%": { opacity: "1" } },
        "msg-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "sheet-in": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } },
        "drawer-in": { from: { transform: "translateX(24px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
      },
      animation: {
        "ping-once": "ping-once 600ms ease-out 1 forwards",
        "tag-in": "tag-in 350ms cubic-bezier(0.34,1.56,0.64,1) 1 both",
        typing: "typing 1.2s ease-in-out infinite",
        "msg-in": "msg-in 220ms cubic-bezier(0.23,1,0.32,1) both",
        "fade-in": "fade-in 180ms ease-out both",
        "sheet-in": "sheet-in 240ms cubic-bezier(0.23,1,0.32,1) both",
        "drawer-in": "drawer-in 260ms cubic-bezier(0.23,1,0.32,1) both",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
