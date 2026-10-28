import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        workspace: "#FAFBFC",
        foreground: "#111827",
        secondary: "#64748B",
        border: "#E5EAF0",
        accent: {
          DEFAULT: "#2563EB",
          foreground: "#FFFFFF",
        },
        success: "#059669",
        warning: "#D97706",
        error: "#DC2626",
      },
      borderRadius: {
        card: "12px",
        input: "8px",
      },
    },
  },
  plugins: [],
};
export default config;