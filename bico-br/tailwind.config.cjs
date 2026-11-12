/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/**/*.html', './web/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        tinta: { DEFAULT: '#0a1411', 700: '#22352e', 500: '#5b6c65', 300: '#a5b3ad' },
        mata: { 50: '#ecfbf3', 100: '#d3f5e3', 300: '#6fe0ad', 400: '#2fcf8a', 500: '#12a76a', 600: '#0b8a56', 700: '#086c44', 900: '#062c1e', 950: '#03170f' },
        sol: { 100: '#fff4d6', 300: '#ffd978', 400: '#f9c440', 500: '#e5a81b' },
        areia: '#f5f3ec',
        creme: '#fbfaf6',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(10,20,17,.04), 0 12px 32px -18px rgba(10,20,17,.22)',
        lift: '0 2px 0 rgba(10,20,17,.04), 0 24px 48px -20px rgba(10,20,17,.32)',
        glow: '0 0 0 1px rgba(47,207,138,.25), 0 18px 50px -18px rgba(18,167,106,.55)',
      },
      letterSpacing: { tightest: '-0.035em' },
    },
  },
  plugins: [],
};
