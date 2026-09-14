// Offline single-file build: everything inlined into dist/lite/index.html so it runs from a double-click (file://).
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The main build gets `virtual:pwa-register` from vite-plugin-pwa; the offline file has no service worker.
const pwaStub = {
  name: 'pwa-register-stub',
  resolveId(id: string) {
    return id === 'virtual:pwa-register' ? '\0pwa-register-stub' : null;
  },
  load(id: string) {
    return id === '\0pwa-register-stub' ? 'export function registerSW() { return () => {}; }' : null;
  },
};

export default defineConfig({
  base: './',
  define: { 'import.meta.env.LITE': 'true' },
  plugins: [pwaStub, svelte(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist/lite',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
    rollupOptions: { input: 'index.html', output: { inlineDynamicImports: true } },
  },
});
