/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#173b3a',
        forest: '#176b62',
        mint: '#e8f5f1',
        cream: '#f7f8f4',
      },
      boxShadow: { card: '0 18px 55px rgba(25, 68, 63, 0.09)' },
    },
  },
  plugins: [],
};
