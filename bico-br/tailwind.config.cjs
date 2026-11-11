/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/**/*.html', './web/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        tinta: { DEFAULT: '#0e1f18', 700: '#1c3a2d', 500: '#4b6358', 300: '#9db0a6' },
        mata: { 50: '#eefaf3', 100: '#d6f3e2', 500: '#12905a', 600: '#0d7a4b', 700: '#0a613c', 900: '#06311f' },
        sol: { 100: '#fff3d1', 400: '#f7c244', 500: '#eaa91c' },
        areia: '#f7f5ef',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(14,31,24,.06), 0 8px 24px -12px rgba(14,31,24,.18)' },
    },
  },
  plugins: [],
};
