/** @type {import('tailwindcss').Config} */
// Identidade definitiva Bico BR — sem azul.
// Verde profundo #071B12 · Verde-musgo #1B5E20 · Dourado #D4AF37 · Amarelo #FFCA05
// Preto #111111 · Branco #FFFFFF · Creme #F8F7F2 · Cinza claro #F1F2EF
module.exports = {
  content: ['./web/**/*.html', './web/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // texto (preto da marca, em tons neutros levemente quentes)
        tinta: { DEFAULT: '#111111', 700: '#2F322F', 500: '#5E635D', 300: '#A8ACA5' },
        // verde profundo: cor institucional, títulos, sidebar, rodapé, botão primário
        floresta: { 950: '#04100A', 900: '#071B12', 800: '#0D2A1C', 700: '#153A27' },
        // verde-musgo: apoio, sucesso, indicadores positivos
        mata: { 50: '#EEF6EF', 100: '#D5EAD8', 300: '#88C493', 400: '#4C9F5C', 500: '#2E7D32', 600: '#1B5E20', 700: '#164C1A', 900: '#0C2E10', 950: '#071A09' },
        // amarelo: conversão
        sol: { 100: '#FFF6CC', 300: '#FFDB4D', 400: '#FFCA05', 500: '#E6B500' },
        // dourado: destaques especiais
        ouro: { DEFAULT: '#D4AF37', 100: '#F7EFD2', 600: '#A8862A' },
        preto: '#111111',
        areia: '#F8F7F2',
        cinza: '#F1F2EF',
        creme: '#FBFAF6',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        display: ['"Montserrat Variable"', '"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(7,27,18,.05), 0 10px 28px -16px rgba(7,27,18,.20)',
        lift: '0 2px 4px rgba(7,27,18,.05), 0 22px 44px -20px rgba(7,27,18,.30)',
        glow: '0 10px 30px -12px rgba(255,202,5,.75)',
      },
      letterSpacing: { tightest: '-0.035em' },
      // padrão do Tailwind é azul: contorno de foco passa a ser verde-musgo
      ringColor: { DEFAULT: '#1B5E20' },
    },
  },
  plugins: [],
};
