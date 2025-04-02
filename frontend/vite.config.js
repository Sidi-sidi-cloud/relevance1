import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Porta per il frontend
    proxy: {
      // Proxy /api richieste al backend sulla porta 3001
      '/api': {
        target: 'http://localhost:3001', // L'URL del tuo backend
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // Rimuovi /api se il backend non lo usa nel path
      }
    }
  }
})