/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          lime: "#84cc16",
          "lime-dim": "#65a30d",
          glow: "rgba(132, 204, 22, 0.35)",
        },
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.04)",
          strong: "rgba(255, 255, 255, 0.07)",
          border: "rgba(255, 255, 255, 0.08)",
        },
        canvas: "#0b0f14",
        ink: {
          muted: "#94a3b8",
          subtle: "#64748b",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.45)",
        lift: "0 20px 50px rgba(0, 0, 0, 0.55)",
        glow: "0 0 0 1px rgba(132, 204, 22, 0.25), 0 0 40px rgba(132, 204, 22, 0.12)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(132, 204, 22, 0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(56, 189, 248, 0.08), transparent), radial-gradient(ellipse 50% 30% at 0% 20%, rgba(132, 204, 22, 0.06), transparent)",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        "fade-up-delay": "fade-up 0.6s ease-out 0.1s forwards",
        "fade-up-delay-2": "fade-up 0.6s ease-out 0.2s forwards",
      },
    },
  },
  plugins: [],
};
