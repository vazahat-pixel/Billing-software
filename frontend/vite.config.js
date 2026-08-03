import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Keep zustand in its own chunk so store modules never import
        // `create` from the app entry (avoids circular init: t is not a function).
        manualChunks(id) {
          if (id.includes('node_modules/zustand')) return 'zustand';
        }
      }
    }
  }
});
