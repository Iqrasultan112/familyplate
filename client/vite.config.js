import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  css: {
    // Use PostCSS to process Tailwind CSS directives (@tailwind, @apply)
    // instead of the default lightningcss which doesn't understand them
    transformer: 'postcss',
  },
});
