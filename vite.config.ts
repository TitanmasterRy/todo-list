import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Where the site is served from. Most hosts (Vercel, Netlify, Render, Replit,
// Cloudflare Pages, Firebase, Surge, Docker) serve from the domain root: "/".
// GitHub Pages serves project sites from /<repo>/; the Pages workflow sets
// GITHUB_PAGES=true and the base is derived from the repository name so a
// rename keeps working. VITE_BASE overrides both (e.g. a custom sub-path).
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'todo-list';
const base = process.env.VITE_BASE ?? (process.env.GITHUB_PAGES === 'true' ? `/${repoName}/` : '/');

export default defineConfig({
  base,
  server: {
    // Replit, Codespaces and Gitpod proxy the dev server through their own hostnames.
    host: process.env.REPL_ID || process.env.CODESPACES || process.env.GITPOD_WORKSPACE_ID ? true : undefined,
    allowedHosts: process.env.REPL_ID || process.env.CODESPACES || process.env.GITPOD_WORKSPACE_ID ? true : undefined,
  },
  preview: {
    host: process.env.REPL_ID ? true : undefined,
    allowedHosts: process.env.REPL_ID ? true : undefined,
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/favicon.svg'],
      manifest: {
        name: 'Homework To-Do',
        short_name: 'Homework',
        description: 'A fast, installable homework to-do list that makes finishing things feel great.',
        theme_color: '#6c5ce7',
        background_color: '#0f1115',
        display: 'standalone',
        start_url: base,
        scope: base,
        share_target: { action: base, method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        // long-press the home-screen icon
        shortcuts: [
          { name: 'New task', short_name: 'New', url: `${base}?view=today&new=1`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Today', url: `${base}?view=today`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Focus', url: `${base}?view=focus`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Play', url: `${base}?view=play`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        // notification clicks + periodic background digest/badge (public/sw-extra.js)
        importScripts: ['sw-extra.js'],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
