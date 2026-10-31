import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#0a0f1e", 900: "#0f1629", 800: "#162038" },
        accent: "#38e1b0",
      },
    },
  },
  plugins: [],
};
export default config;
