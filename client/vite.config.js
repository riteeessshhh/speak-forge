import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxyConfig = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
  '/health': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
};

// Vite config: registers React (JSX transform) and Tailwind CSS (v4 Vite plugin)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: proxyConfig,
  },
  preview: {
    host: true,
    port: 4173,
    proxy: proxyConfig,
  },
})
