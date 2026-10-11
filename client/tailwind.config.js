const familyPlatePrimary = {
  50: '#FFF7F2', 100: '#FCE8DE', 200: '#F5CCBD', 300: '#EAA693',
  400: '#C86D55', 500: '#AF513D', 600: '#983E2F', 700: '#7D3227',
  800: '#65271F', 900: '#4E1D18', 950: '#341510',
};
const familyPlateNeutral = {
  50: '#FFFCF8', 100: '#F7F1EB', 200: '#E9DDD1', 300: '#D3BFB1',
  400: '#8B766B', 500: '#6E5C52', 600: '#57483F', 700: '#41362F',
  800: '#2E2722', 900: '#1D1815', 950: '#120E0C',
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
        // Warm food-inspired accents complement the tomato-red primary color.
        accent: {
          pink:  '#C2415D',
          teal:  '#AF513D',
          amber: '#B45309',
          rose:  '#BE123C',
          sky:   '#0369A1',
          green: '#15803D',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'card':       '0 2px 10px -2px rgba(71, 36, 24, 0.06), 0 1px 4px -1px rgba(71, 36, 24, 0.03)',
        'card-lg':    '0 8px 24px -4px rgba(71, 36, 24, 0.10), 0 2px 8px -2px rgba(71, 36, 24, 0.04)',
        'float':      '0 12px 32px -4px rgba(71, 36, 24, 0.12)',
      }
    },
  },
  plugins: [],
};
