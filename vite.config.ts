import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// În dezvoltare, /api merge la backend-ul .NET pe același origin,
// așa că cookie-ul refresh_token funcționează fără CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5228',
    },
  },
})
