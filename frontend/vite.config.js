import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDesktop = process.env.VITE_DESKTOP === '1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDesktop = process.env.VITE_DESKTOP === '1';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Relative asset paths required for Electron loadFile()
  base: isDesktop ? './' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: isDesktop
      ? path.resolve(__dirname, '../desktop/renderer')
      : 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
});
