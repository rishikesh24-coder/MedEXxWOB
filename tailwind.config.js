/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Medical Teal & Marine palette
        primary: {
          DEFAULT: '#0A6E79',
          50: '#F0F9FA',
          100: '#D5F1F3',
          200: '#AFE2E7',
          300: '#7ACCD6',
          400: '#3BB0C0',
          500: '#0A6E79',
          600: '#085861',
          700: '#07454D',
          800: '#05353B',
          900: '#03252A',
          950: '#02181B',
        },
        // Dark Ocean / Navy for high-contrast enterprise surfaces
        secondary: {
          DEFAULT: '#0E1E28',
          50: '#F1F5F8',
          100: '#DDE7EE',
          200: '#BACFDC',
          300: '#92B3C5',
          400: '#5F8BA3',
          500: '#386680',
          600: '#23495F',
          700: '#173446',
          800: '#0E2230',
          900: '#091621',
          950: '#050C13',
        },
        ocean: {
          DEFAULT: '#0E1E28',
          50: '#F1F5F8',
          100: '#DDE7EE',
          200: '#BACFDC',
          300: '#92B3C5',
          400: '#5F8BA3',
          500: '#386680',
          600: '#23495F',
          700: '#173446',
          800: '#0E2230',
          900: '#091621',
          950: '#050C13',
        },
        // Specialized Healthcare Status Accents
        accent: {
          teal: '#0A6E79',
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#E11D48',
          blue: '#2563EB',
          indigo: '#4F46E5',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          ground: '#F8FAFC',
          subtle: '#F1F5F9',
          card: '#FFFFFF',
          dark: '#0A1722',
          border: '#E2E8F0',
          'border-strong': '#CBD5E1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 12px 24px -6px rgba(10, 110, 121, 0.12), 0 4px 8px -2px rgba(15, 23, 42, 0.06)',
        'elevated': '0 14px 28px -4px rgba(9, 22, 33, 0.16), 0 6px 12px -2px rgba(9, 22, 33, 0.08)',
        'spatial': '0 20px 40px -12px rgba(10, 110, 121, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'spatial-dark': '0 24px 48px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'teal-glow': '0 0 24px -4px rgba(10, 110, 121, 0.35)',
        'amber-glow': '0 0 20px -4px rgba(245, 158, 11, 0.35)',
        'emerald-glow': '0 0 20px -4px rgba(16, 185, 129, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-gentle': 'floatGentle 5s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
