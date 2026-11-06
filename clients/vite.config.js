
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  appType: 'spa',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    open: true,
    host: true,
  },
  build: {
    outDir: 'dist',
  },
});
