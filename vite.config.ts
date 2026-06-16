import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to the app service
      '/api': {
        target: process.env.SERVER_HTTPS || process.env.SERVER_HTTP,
        changeOrigin: true
      },
      // Proxy file uploads / media to the upload service
      '/media': {
        target: process.env.UPLOADS_HTTPS || process.env.UPLOADS_HTTP,
        changeOrigin: true
      }
    }
  }
})
