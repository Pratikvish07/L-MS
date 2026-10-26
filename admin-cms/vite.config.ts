import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy the video API through the dev server so browser requests are
      // same-origin (http://localhost:5173/api/...) and avoid CORS blocks from
      // the external video service, which does not send Access-Control-Allow-Origin.
      '/api': {
        target: 'https://nvqf.vocmanindia.com',
        changeOrigin: true,
      },
    },
  },
})
