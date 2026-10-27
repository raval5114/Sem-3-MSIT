import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'DineFlow',
        short_name: 'DineFlow',
        description: 'Smart Contactless Dining Platform — Staff Portal',
        theme_color: '#f97316',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          { name: 'Login', url: '/login', description: 'Sign in to DineFlow' },
          { name: 'Dashboard', url: '/dashboard', description: 'Staff Dashboard' },
        ],
      },
      workbox: {
        // Cache strategies — network first for API, cache first for static assets
        runtimeCaching: [
          {
            // Auth API — network first (always fresh JWT responses)
            urlPattern: /^http:\/\/localhost:8081\/auth\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dineflow-auth-api',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Static assets — cache first
            urlPattern: /\.(?:js|css|woff2?|png|svg|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dineflow-static-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api/auth → auth-service (port 8081) when running locally
      '/api/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, '/auth'),
      },
    },
  },
})
