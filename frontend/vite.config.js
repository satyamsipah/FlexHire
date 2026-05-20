import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy /api requests to the Express backend so we avoid CORS issues in dev
    proxy: {
      '/api': {
        target:       'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
