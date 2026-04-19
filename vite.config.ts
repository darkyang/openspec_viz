import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@web': path.resolve(__dirname, 'src/web'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4567',
      '/sse': {
        target: 'http://localhost:4567',
        ws: false,
        changeOrigin: true,
        // SSE 需要 keep-alive,关闭 buffer
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
  },
})
