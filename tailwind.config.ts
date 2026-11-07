import type { Config } from 'tailwindcss';

// Tailwind v4: design tokens live in src/app/globals.css @theme.
// This file is kept for tooling compatibility only.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [],
};

export default config;