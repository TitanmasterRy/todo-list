import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build (service worker included) served by `vite preview`.
// Locally, set PW_CHROMIUM to use an already-installed Chromium instead of `npx playwright install`,
// and PW_PORT to run a second copy of the suite alongside another one.
const port = Number(process.env.PW_PORT) || 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
