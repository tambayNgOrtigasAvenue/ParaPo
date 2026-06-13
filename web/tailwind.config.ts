import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ParaPo palette — Maya-inspired: fresh spring green on clean light surfaces.
        ink: "#072A1E", // deep green-black — dark sections, primary text, balance card
        surface: "#0C3A29", // dark green — gradient pair for the balance card
        card: "#FFFFFF", // white cards
        paper: "#EEF4EF", // app background (soft green-tinted off-white)
        brand: {
          light: "#3DDC97", // bright Maya green — fills, glows, on-dark text
          DEFAULT: "#0FB866", // Maya green — accents, bold green text
          dark: "#0A8F4F", // deep green — button hover / strong text
        },
        accent: "#F5A623", // jeepney amber
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        glow: "0 18px 50px -18px rgba(15,184,102,0.45)",
        card: "0 10px 30px -16px rgba(7,42,30,0.18)",
        balance: "0 24px 60px -24px rgba(7,42,30,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
