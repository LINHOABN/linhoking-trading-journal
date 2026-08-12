import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        graphite: {
          950: '#0A0C0F',
          900: '#0F1216',
          850: '#14171D',
          800: '#1A1E25',
          700: '#262B33',
          600: '#3A414C',
        },
        paper: {
          50: '#F7F7F5',
          100: '#F1F1EE',
          200: '#E4E4E0',
          300: '#DDE1E6',
        },
        ink: {
          900: '#14171C',
          700: '#3A414C',
          500: '#5B6470',
          300: '#8B92A0',
        },
        // Functional signal colors — used only for data meaning, never decoration
        signal: {
          gain: '#2FBF71',
          gainDim: '#1F8A50',
          loss: '#E5484D',
          lossDim: '#A8353A',
          warn: '#D89614',
          warnDim: '#9C6B0D',
          data: '#5B8DEF',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Plus Jakarta Sans"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        premium: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glow: '0 0 15px rgba(91, 141, 239, 0.45)',
        'glow-gain': '0 0 15px rgba(47, 191, 113, 0.4)',
        'glow-loss': '0 0 15px rgba(229, 72, 77, 0.4)',
      },
      letterSpacing: {
        widest2: '0.18em',
      },
    },
  },
  plugins: [],
} satisfies Config
