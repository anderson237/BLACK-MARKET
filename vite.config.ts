import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        input: {
          admin: path.resolve(__dirname, 'admin.html'),
        },
        output: {
          // Split heavy vendor libraries into their own cacheable chunks.
          // The content hash keeps these stable across deploys (immutable caching).
          manualChunks: {
            react: ['react', 'react-dom', 'react/jsx-runtime'],
            motion: ['motion'],
            icons: ['lucide-react'],
          },
        },
      },
      // Increase the chunk size warning threshold: our vendor chunks are large by design.
      chunkSizeWarningLimit: 1000,
    },
  };
});
