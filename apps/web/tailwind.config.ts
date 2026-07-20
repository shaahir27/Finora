import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-base': 'var(--color-bg-base)',
        'surface-glass': 'var(--color-surface-glass)',
        'surface-glass-hero': 'var(--color-surface-glass-hero)',
        'border-glass': 'var(--color-border-glass)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'accent-primary': 'var(--color-accent-primary)',
        'accent-primary-text': 'var(--color-accent-primary-text)',
        'risk-high': 'var(--color-risk-high)',
        'risk-medium': 'var(--color-risk-medium)',
        'risk-low': 'var(--color-risk-low)',
        'status-posted': 'var(--color-status-posted)',
        'status-cheque-pending': 'var(--color-status-cheque-pending)',
        'status-flagged': 'var(--color-status-flagged)',
        'status-reversed': 'var(--color-status-reversed)',
      }
    },
  },
  plugins: [],
};
export default config;
