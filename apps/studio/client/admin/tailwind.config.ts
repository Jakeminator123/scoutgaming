import type { Config } from 'tailwindcss'

// shadcn-namnen i app/globals.css är alias till --sg-* (hex), inte HSL-tripplar.
const mix = (name: string) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Surfaces follow the --sg-* tokens in packages/ui/tokens.css (dark by default, light with
        // the class light on <html>). Lime, teal, amber and red keep hex so /opacity variants work.
        sg: {
          bg: 'var(--sg-bg)',
          panel: 'var(--sg-surface)',
          line: 'var(--sg-border)',
          text: 'var(--sg-text)',
          muted: 'var(--sg-muted)',
          // The Admin kit (components/ui) reads every surface, line and tone from the tokens.
          surface: 'var(--sg-surface)',
          'surface-2': 'var(--sg-surface-2)',
          hover: 'var(--sg-hover)',
          border: 'var(--sg-border)',
          'line-2': 'var(--sg-line-2)',
          faint: 'var(--sg-faint)',
          ink: 'var(--sg-ink)',
          'side-text': 'var(--sg-side-text)',
          'on-accent': 'var(--sg-on-accent)',
          'accent-text': 'var(--sg-accent-text)',
          'accent-bg': 'var(--sg-accent-bg)',
          ok: 'var(--sg-ok)',
          'ok-bg': 'var(--sg-ok-bg)',
          info: 'var(--sg-info)',
          'info-bg': 'var(--sg-info-bg)',
          warn: 'var(--sg-warn-text)',
          'warn-bg': 'var(--sg-warn-bg)',
          danger: 'var(--sg-danger-text)',
          'danger-bg': 'var(--sg-danger-bg)',
          'danger-line': 'var(--sg-danger-line)',
          lime: '#d6ff3a',
          teal: '#3ad6c4',
          amber: '#ffb547',
          red: '#ff5c6c',
        },
        background: mix('--background'),
        foreground: mix('--foreground'),
        card: {
          DEFAULT: mix('--card'),
          foreground: mix('--card-foreground'),
        },
        popover: {
          DEFAULT: mix('--popover'),
          foreground: mix('--popover-foreground'),
        },
        primary: {
          DEFAULT: mix('--primary'),
          foreground: mix('--primary-foreground'),
        },
        secondary: {
          DEFAULT: mix('--secondary'),
          foreground: mix('--secondary-foreground'),
        },
        muted: {
          DEFAULT: mix('--muted'),
          foreground: mix('--muted-foreground'),
        },
        accent: {
          DEFAULT: mix('--accent'),
          foreground: mix('--accent-foreground'),
        },
        destructive: {
          DEFAULT: mix('--destructive'),
          foreground: mix('--destructive-foreground'),
        },
        border: mix('--border'),
        input: mix('--input'),
        ring: mix('--ring'),
      },
      boxShadow: {
        sg: 'var(--sg-shadow)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
