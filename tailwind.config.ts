/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: "#7dd3fc",
        accent: "#0369a1",
        ink: "#0c1e3a",
        brick: "#dc2626",
        forest: "#15803d",
      },
    },
  },
  plugins: [],
};
