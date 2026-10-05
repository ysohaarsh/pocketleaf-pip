import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets GitHub Pages serve from /<repo>/ while local/Vercel builds use '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
