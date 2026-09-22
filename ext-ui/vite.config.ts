import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  build: {
    outDir: path.resolve(rootDir, '../dist'),
    emptyOutDir: false,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        popup: path.resolve(rootDir, 'popup.html'),
        options: path.resolve(rootDir, 'options.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'ui-chunks/[name]-[hash].js',
        assetFileNames: 'assets/ui/[name][extname]',
      },
    },
  },
})
