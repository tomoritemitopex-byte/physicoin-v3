/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f2ecdf",
        "paper-2": "#e7ddc9",
        ink: "#0b0b0b",
        "ink-2": "#1a1a1a",
        lime: "#c6f135",
        coral: "#ff5a3c",
        blue: "#2d6bff",
        yellow: "#ffd23f",
        green: "#1f9d55",
        // legacy aliases kept so existing pages keep working
        sky: "#c6f135",
        accent: "#ff5a3c",
        brick: "#ff5a3c",
        forest: "#1f9d55",
      },
      fontFamily: {
        display: ["var(--font-display)", "Arial Black", "system-ui", "sans-serif"],
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        brutal: "5px 5px 0 #0b0b0b",
        "brutal-sm": "3px 3px 0 #0b0b0b",
        "brutal-lime": "5px 5px 0 #c6f135",
        "brutal-coral": "5px 5px 0 #ff5a3c",
        "brutal-white": "5px 5px 0 #fffdf7",
      },
      borderRadius: {
        brutal: "2px",
      },
    },
  },
  plugins: [],
};
