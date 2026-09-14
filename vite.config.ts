import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves project sites from /<repo>/. Derive the base from the
// repository name in CI (GITHUB_REPOSITORY = "owner/repo") so a rename keeps
// working; default to the current repo name for local production builds.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'todo-list';
const base = process.env.VITE_BASE ?? (process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/');

export default defineConfig({
  base,
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
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
