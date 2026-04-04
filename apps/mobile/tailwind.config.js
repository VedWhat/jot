/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#E24B4A',
      },
      fontFamily: {
        sans: ['DMSans', 'System'],
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
};
