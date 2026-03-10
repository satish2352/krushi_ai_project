import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        surface: "#ffffff",
        primary: "#0f172a",
        subtle: "#e2e8f0"
      }
    }
  },
  plugins: []
};

export default config;

