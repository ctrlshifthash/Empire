/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // medieval / Age of Empires inspired palette
        parchment: {
          DEFAULT: "#efe2c2",
          50: "#fbf6e9",
          100: "#f5ecd4",
          200: "#efe2c2",
          300: "#e2cf9f",
          400: "#cdb277",
        },
        ink: {
          DEFAULT: "#1c1710",
          800: "#241d14",
          700: "#34291c",
          600: "#4a3a27",
        },
        gold: {
          DEFAULT: "#c9a227",
          light: "#e8c75a",
          dark: "#9c7c14",
        },
        forest: {
          DEFAULT: "#2f5d3a",
          dark: "#1e3d27",
          light: "#3f7a4d",
        },
        stone: {
          DEFAULT: "#6b6357",
          dark: "#3a352e",
          light: "#9b9384",
        },
        blood: {
          DEFAULT: "#9c2b21",
          light: "#c0392b",
          dark: "#6e1d16",
        },
        royal: {
          DEFAULT: "#2c4a7c",
          light: "#3f6bb0",
        },
      },
      fontFamily: {
        display: ['"Cinzel"', "Georgia", "serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 10px 30px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        gold: "0 0 0 1px rgba(201,162,39,0.5), 0 8px 24px -8px rgba(201,162,39,0.45)",
        deep: "0 24px 60px -20px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(1200px 600px at 50% -10%, rgba(201,162,39,0.18), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(44,74,124,0.25), transparent 55%)",
        "parchment-tex":
          "linear-gradient(180deg, rgba(239,226,194,0.96), rgba(226,207,159,0.96))",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        pulseGlow: "pulseGlow 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
