import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Moduri:
// - dezvoltare / producție normală: /api merge la backend-ul .NET;
// - `--mode pages`: versiunea demo pentru GitHub Pages (date simulate, subfolder /programari-unghii/).
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/programari-unghii/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    // În dezvoltare, /api merge la backend pe același origin, ca cookie-ul refresh_token să funcționeze fără CORS.
    proxy: {
      '/api': 'http://localhost:5228',
    },
  },
}))
