/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vibrant warm tones for foods: deep pomegranate / gold copper
        brand: {
          50: '#fdf4f5',
          100: '#fbe8eb',
          200: '#f7d6da',
          300: '#f0b7bf',
          400: '#e58d9b',
          500: '#d56073',
          600: '#c14157',
          700: '#a23044',
          800: '#862b3b',
          900: '#712735',
          950: '#3f111a',
        },
        accent: {
          50: '#faf8f5',
          100: '#f3ece3',
          200: '#e5d7c4',
          300: '#d2bc9d',
          400: '#bd9e75',
          500: '#ab8353',
          600: '#9b7044',
          700: '#815a38',
          800: '#694931',
          900: '#553c2b',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
