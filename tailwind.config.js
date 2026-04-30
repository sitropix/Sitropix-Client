/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          lime: "#080808",
          "lime-dim": "#353536",
          glow: "rgba(8, 8, 8, 0.2)",
        },
        admin: {
          lime: "#84CC16",
          "lime-dim": "#65a30d",
          glow: "rgba(132, 204, 22, 0.25)",
          canvas: "#0a0a0a",
          surface: "#15191C",
          "surface-alt": "#1C2126",
          border: "#24292E",
          "border-alt": "#2b3137",
        },
        zinc: {
          50: "#EBEDF1",
          100: "#EBEDF1",
          200: "#DDE0E6",
          300: "#D4D8DF",
          400: "#ACADB1",
          500: "#8E8F93",
          600: "#706F70",
          700: "#706F70",
          800: "#4A4A4D",
          900: "#353536",
          950: "#080808",
        },
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.74)",
          strong: "rgba(255, 255, 255, 0.9)",
          border: "rgba(112, 111, 112, 0.3)",
        },
        canvas: "#EBEDF1",
        ink: {
          muted: "#706F70",
          subtle: "#4A4A4D",
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
        glass: "0 10px 26px rgba(53, 53, 54, 0.12)",
        lift: "0 18px 40px rgba(53, 53, 54, 0.18)",
        glow: "0 0 0 1px rgba(8, 8, 8, 0.2), 0 0 24px rgba(53, 53, 54, 0.12)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(172, 173, 177, 0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(212, 216, 223, 0.2), transparent), radial-gradient(ellipse 50% 30% at 0% 20%, rgba(112, 111, 112, 0.12), transparent)",
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
