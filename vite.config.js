import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works from any subpath (e.g. GitHub Pages).
  base: './',
  test: {
    globals: true,
    environment: 'node',
  },
});
