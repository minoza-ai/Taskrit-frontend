import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/chat-api': {
        target: process.env.VITE_CHAT_API_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chat-api/, ''),
      },
      '/chat-ws': {
        target: process.env.VITE_CHAT_WS_TARGET ?? 'ws://localhost:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/chat-ws/, '/ws'),
      },
    },
  },
})
