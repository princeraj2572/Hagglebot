import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chalk: "#EEF1F4",
        paper: "#F8F9FB",
        ink: "#12161C",
        muted: "#566070",
        line: "#CFD6DE",
        ultra: "#2B3FD6", // our offers and the pay action
        tag: "#F2B31B", // seller asks (price-tag yellow); fill only, never text
        scam: "#C8283C", // scams only
      },
      keyframes: {
        "ping-once": { "0%": { transform: "scale(1)", opacity: "0.8" }, "100%": { transform: "scale(2.8)", opacity: "0" } },
        "tag-in": { "0%": { transform: "scale(0.6) rotate(-14deg)", opacity: "0" }, "100%": { transform: "scale(1) rotate(-2deg)", opacity: "1" } },
        typing: { "0%, 60%, 100%": { opacity: "0.3" }, "30%": { opacity: "1" } },
        "msg-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "ping-once": "ping-once 600ms ease-out 1 forwards",
        "tag-in": "tag-in 350ms cubic-bezier(0.34,1.56,0.64,1) 1 both",
        typing: "typing 1.2s ease-in-out infinite",
        "msg-in": "msg-in 220ms cubic-bezier(0.23,1,0.32,1) both",
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
