import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New deploys replace the cached app on the next visit, so nobody gets stuck on an old version.
      registerType: 'autoUpdate',
      manifest: {
        name: 'Skill Tree',
        short_name: 'Skill Tree',
        description: 'Learn football the way you level up in a game. Pass the test, unlock the next skill.',
        theme_color: '#0a2118',
        background_color: '#0e2c20',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // The artwork sits inside the safe zone, so Android can crop it to any shape.
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // og-image.png is only for link previews; no need to store it on phones.
        globIgnores: ['og-image.png'],
        // Fonts ship with the app (#22), so the woff2 pattern above stores them for offline use.
      },
    }),
  ],
})
