import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // App title is configurable at build time via VITE_APP_TITLE,
  // with a sensible default so the <title> placeholder is always resolved.
  const appTitle = env.VITE_APP_TITLE || 'Pret Links'

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // Replace the %VITE_APP_TITLE% placeholder in index.html, guaranteeing
        // a fallback even when the env var is unset.
        name: 'html-app-title',
        transformIndexHtml(html) {
          return html.replace(/%VITE_APP_TITLE%/g, appTitle)
        },
      },
    ],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': 'http://localhost:3006',
        '/uploads': 'http://localhost:3006',
      },
    },
  }
})
