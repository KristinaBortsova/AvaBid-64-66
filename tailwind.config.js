/** @type {import('tailwindcss').Config} */
export default {
  content: [
  "./*.html",
  "./*.js",
  "./pages/**/*.html",
  "./pages/**/*.js",
],
  theme: {
    extend: {
      colors: {
        'card': '#FFFFFF',
        'main': '#5F6E63',
        'cat-inactive': '#D9D9D9',
        'cat-active': '#A6A6A6',
        'cat-active-text': '#F0F8F2',
        'slogan': '#7A8F80',
        'lot-border': '#5F6E63',
        'price': '#353F37',
        'bell-border': '#839A88',
        'bell-bg': '#E8EFE5',
        'input-bg': '#E8EFE5',
      },
      fontFamily: {
        'main': ['"Alegreya Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};