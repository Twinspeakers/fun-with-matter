import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages project site: https://twinspeakers.github.io/fun-with-matter/
  // Use the subpath only for production builds; keep dev server at '/'
  base: command === 'build' ? '/fun-with-matter/' : '/',
}));
