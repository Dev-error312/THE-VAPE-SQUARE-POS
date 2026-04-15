/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  // 'class' strategy: Tailwind applies dark: variants when <html> has class="dark"
  // This is controlled by our useTheme hook + the anti-flicker script in index.html
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        // Modern dark blue accent system
        primary: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          200: '#b3c5d9',
          300: '#8ca7c6',
          400: '#6589b3',
          500: '#3d6ba0',
          600: '#2e5084',
          700: '#1f3a68',
          800: '#15284d',
          900: '#0f1a32',
          950: '#0a0f1f',
        },
        // Sophisticated accent colors
        accent: {
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          cyan: '#06b6d4',
          teal: '#14b8a6',
        },
        // Modern dark mode backgrounds
        dark: {
          bg: '#0f172a',        // Deep navy
          surface: '#1e293b',   // Surface layer
          card: '#334155',      // Card layer
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'fade-in': {
          'from': { opacity: '0', transform: 'translateY(4px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'sm-glow': '0 2px 8px rgba(45, 80, 132, 0.1)',
        'glow': '0 4px 20px rgba(45, 80, 132, 0.15)',
        'lg-glow': '0 8px 32px rgba(45, 80, 132, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },

  plugins: [],
}
