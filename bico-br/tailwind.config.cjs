/** @type {import('tailwindcss').Config} */
// Identidade oficial Bico BR: azul-marinho #0B1F44 (principal), dourado #D4AF37 (destaque),
// verde-musgo #1B5E20 (apoio/sucesso), amarelo #FFCA05 (ação), preto #0E0E0E, cinza #F5F6F8, branco.
module.exports = {
  content: ['./web/**/*.html', './web/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // texto e títulos (azul-marinho da marca)
        tinta: { DEFAULT: '#0B1F44', 700: '#26365A', 500: '#5A6478', 300: '#A6ADBB' },
        marinho: { 950: '#06122B', 900: '#0B1F44', 800: '#122B5A', 700: '#1B3A73' },
        // verde-musgo (apoio, sucesso, oportunidade)
        mata: { 50: '#ECF6EE', 100: '#D3EAD7', 300: '#86C493', 400: '#4CA05F', 500: '#2E7D32', 600: '#1B5E20', 700: '#164C1A', 900: '#0C2E10', 950: '#071A09' },
        // amarelo (ação, conversão)
        sol: { 100: '#FFF6CC', 300: '#FFDB4D', 400: '#FFCA05', 500: '#E6B500' },
        ouro: { DEFAULT: '#D4AF37', 100: '#F6EDCF', 600: '#B8952A' },
        preto: '#0E0E0E',
        areia: '#F5F6F8',
        creme: '#FAFBFC',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        display: ['"Montserrat Variable"', '"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,31,68,.05), 0 10px 28px -16px rgba(11,31,68,.22)',
        lift: '0 2px 4px rgba(11,31,68,.05), 0 22px 44px -20px rgba(11,31,68,.32)',
        glow: '0 10px 30px -12px rgba(255,202,5,.75)',
      },
      letterSpacing: { tightest: '-0.035em' },
    },
  },
  plugins: [],
};
