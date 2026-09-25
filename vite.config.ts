import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { buildCsp } from './src/lib/csp';

// Where the site is served from. Most hosts (Vercel, Netlify, Render, Replit,
// Cloudflare Pages, Firebase, Surge, Docker) serve from the domain root: "/".
// GitHub Pages serves project sites from /<repo>/; the Pages workflow sets
// GITHUB_PAGES=true and the base is derived from the repository name so a
// rename keeps working. VITE_BASE overrides both (e.g. a custom sub-path).
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'todo-list';
const base = process.env.VITE_BASE ?? (process.env.GITHUB_PAGES === 'true' ? `/${repoName}/` : '/');

// "What's new" compares this with the last heading the user saw (the notes themselves load on demand).
const changelogHead = (readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8').match(/^## (.+)$/m)?.[1] ?? '').trim();

// Content-Security-Policy as a <meta> in the production index.html (dev needs inline HMR scripts and ws:, so it
// has none; the offline single-file build in vite.lite.config.ts inlines its scripts and has none either).
// The host list lives in src/lib/csp.ts. VITE_CSP=off leaves it out; VITE_CSP_CONNECT adds origins.
function cspMeta(): Plugin {
  let policy = '';
  return {
    name: 'csp-meta',
    apply: 'build',
    configResolved(config) {
      const env = { ...config.env, ...process.env } as Record<string, string | undefined>;
      policy = env.VITE_CSP === 'off' ? '' : buildCsp({ supabaseUrl: env.VITE_SUPABASE_URL, arcadeManifest: env.VITE_ARCADE_MANIFEST, extraConnect: env.VITE_CSP_CONNECT });
    },
    transformIndexHtml(html) {
      if (!policy) return html;
      // right after <meta charset> so it applies before any script or stylesheet
      return html.replace(/(<meta charset="UTF-8" \/>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}

export default defineConfig({
  base,
  define: { __CHANGELOG_HEAD__: JSON.stringify(changelogHead) },
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
    cspMeta(),
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
    setupFiles: ['src/lib/i18n/test-setup.ts'],
  },
});
