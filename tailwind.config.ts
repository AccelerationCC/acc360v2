import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './contexts/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Every colour points at a custom property declared in app/globals.css,
      // which is where the newsroom's tokens were translated to. Tailwind v3
      // can't read that app's v4 @theme block, so var() is the bridge — one
      // definition per colour, no hex duplicated here.
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // `navy` kept as an alias so existing bg-navy markup keeps working
        // while screens are converted one at a time; it now resolves to the
        // cream page colour, not charcoal.
        navy: {
          DEFAULT: 'var(--background)',
          dark: 'var(--background)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          accent: 'var(--sidebar-accent)',
          border: 'var(--sidebar-border)',
        },
        // The bronze accent. `accent.orange` and friends are retained as
        // aliases pointing at bronze so no screen renders an unstyled colour
        // mid-conversion; `accent.teal` is retired to --chart-2.
        accent: {
          DEFAULT: 'var(--accent)',
          orange: 'var(--color-acc-blue)',
          yellow: 'var(--color-acc-gold)',
          teal: 'var(--chart-2)',
          pale: 'var(--color-acc-blue)',
        },
        'acc-blue': 'var(--color-acc-blue)',
        'acc-gold': 'var(--color-acc-gold)',
        surface: 'var(--color-surface)',
        bronze: 'var(--color-bronze)',
        'muted-ink': 'var(--color-muted-ink)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // `muted` is a TEXT tone in this codebase, not a surface: 124
        // `text-muted` uses against a single `bg-muted`. It was #7B7C81, a
        // mid-grey that read on charcoal. Pointing DEFAULT at the pale
        // --muted surface painted pale-on-cream and washed out every
        // secondary label in the app, so DEFAULT is the measured muted ink
        // and the surface moves to `muted-surface` for the one bg- use.
        muted: {
          DEFAULT: 'var(--color-muted-ink)',
          foreground: 'var(--muted-foreground)',
          surface: 'var(--muted)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        // `light` was the old cream text colour on charcoal. Inverted now:
        // it is the dark ink that reads on the cream page.
        light: 'var(--foreground)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        editorial: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        // Display italic, entrance pages only.
        display: ['Instrument Serif', 'Georgia', 'serif'],
        // `serif` kept as an alias so existing font-serif markup resolves to
        // the editorial face rather than a browser default mid-conversion.
        serif: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 12px)',
      },
      borderWidth: {
        DEFAULT: '0.5px',
        '0': '0px',
        '2': '2px',
        '4': '4px',
        '8': '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    function({ addUtilities }: { addUtilities: (utils: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-none::-webkit-scrollbar': {
          display: 'none',
        },
      })
    },
  ],
}

export default config
