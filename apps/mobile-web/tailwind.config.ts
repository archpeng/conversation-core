import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 20% 88%)",
        surface: "hsl(0 0% 100%)",
        ink: "hsl(222 24% 12%)",
        muted: "hsl(215 12% 45%)"
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
} satisfies Config;
