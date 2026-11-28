/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

/** The commit this build came from: CI and Vercel set it, local builds ask git. */
function commitSha(): string {
  const fromEnv = process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  test: {
    // The in-memory Postgres (PGlite) tests start a database in each hook, which takes several seconds on a busy machine.
    // Vitest's default 10 s hook limit made those suites fail intermittently under load, so give them room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  define: {
    // Shown under Settings > About, so a bug report says which build it came from.
    __APP_VERSION__: JSON.stringify(`${commitSha()} · ${new Date().toISOString().slice(0, 10)}`),
  },
  plugins: [
    react(),
    VitePWA({
      // New deploys replace the cached app on the next visit, so nobody gets stuck on an old version.
      registerType: 'autoUpdate',
      manifest: {
        name: 'hapi skill',
        short_name: 'hapi skill',
        description: 'Learn football the way you level up in a game. Pass the test, unlock the next skill.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
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
        // The Supabase library is only for signed-in players, so it downloads when someone signs in, not for everyone.
        globIgnores: ['og-image.png', 'assets/supabase-*.js'],
        // Fonts ship with the app (#22), so the woff2 pattern above stores them for offline use.
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // A fixed name lets the offline store above skip this file.
        manualChunks: (id) => (id.includes('node_modules/@supabase/') ? 'supabase' : undefined),
      },
    },
  },
})
