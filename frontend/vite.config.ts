import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    port: 5173,
    proxy: {
      // 🌟 UPDATED: Catch socket.io handshakes and route them securely over WebSocket lines
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        timeout: 60000,      // 🌟 Allow up to 60s for the handshake stability
        proxyTimeout: 60000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy Warning] Waiting for backend server to finish booting...', err.message);
          });
        },
      },
      '/api': { 
        target: 'http://localhost:5000', 
        changeOrigin: true 
      },
      '/uploads': { 
        target: 'http://localhost:5000', 
        changeOrigin: true 
      },
    },
  },
})