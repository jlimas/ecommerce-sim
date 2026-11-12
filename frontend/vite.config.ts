/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_TARGET = process.env.ARKANOID_API_URL ?? 'http://localhost:8000'
const API_PREFIXES = ['/products', '/cart', '/payments', '/images']

// The FastAPI backend has no CORS, so the dev server proxies API routes to it.
// Client routes use Spanish paths (/catalogo, /envios...) so they never collide with these prefixes.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_PREFIXES.map((prefix) => [
        prefix,
        {
          target: API_TARGET,
          changeOrigin: true,
        },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
