import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          900: 'rgb(var(--color-base-900) / <alpha-value>)',
          800: 'rgb(var(--color-base-800) / <alpha-value>)',
          700: 'rgb(var(--color-base-700) / <alpha-value>)',
          600: 'rgb(var(--color-base-600) / <alpha-value>)',
        },
        ink: {
          400: 'rgb(var(--color-ink-400) / <alpha-value>)',
          500: 'rgb(var(--color-ink-500) / <alpha-value>)',
          600: 'rgb(var(--color-ink-600) / <alpha-value>)',
        },
        mint: {
          300: 'rgb(var(--color-mint-300) / <alpha-value>)',
          400: 'rgb(var(--color-mint-400) / <alpha-value>)',
          500: 'rgb(var(--color-mint-500) / <alpha-value>)',
          600: 'rgb(var(--color-mint-600) / <alpha-value>)',
        },
        overlay: 'rgb(var(--color-overlay) / <alpha-value>)',
        link: {
          DEFAULT: 'rgb(var(--color-link) / <alpha-value>)',
          hover: 'rgb(var(--color-link-hover) / <alpha-value>)',
        },
      },
      borderRadius: { '2xl': '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config
