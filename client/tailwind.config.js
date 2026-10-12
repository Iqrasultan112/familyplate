const familyPlatePrimary = {
  50: '#EFF8F4', 100: '#D9EEE5', 200: '#B8DFD0', 300: '#8CC7B1',
  400: '#56A98D', 500: '#318B70', 600: '#24745E', 700: '#1D5E4E',
  800: '#174D43', 900: '#123D36', 950: '#102E2A',
};
const familyPlateNeutral = {
  50: '#FBFDFC', 100: '#F2F7F4', 200: '#E2EBE6', 300: '#C8D6CF',
  400: '#82948B', 500: '#65776E', 600: '#4C5E55', 700: '#35463E',
  800: '#26372F', 900: '#1B2A24', 950: '#14221C',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Keep old page utility names visually consistent with the shared theme.
        slate: familyPlateNeutral,
        gray: familyPlateNeutral,
        blue: familyPlatePrimary,
        indigo: familyPlatePrimary,
        purple: familyPlatePrimary,
        primary: familyPlatePrimary,
        // Fresh greens lead; warm citrus keeps food actions easy to spot.
        accent: {
          pink:  '#C65370',
          teal:  '#318B70',
          amber: '#D17A28',
          rose:  '#C65370',
          sky:   '#367E9A',
          green: '#24745E',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'card':       '0 2px 10px -2px rgba(25, 57, 44, 0.06), 0 1px 4px -1px rgba(25, 57, 44, 0.03)',
        'card-lg':    '0 8px 24px -4px rgba(25, 57, 44, 0.10), 0 2px 8px -2px rgba(25, 57, 44, 0.04)',
        'float':      '0 12px 32px -4px rgba(25, 57, 44, 0.12)',
      }
    },
  },
  plugins: [],
};
