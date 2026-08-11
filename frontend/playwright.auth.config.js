import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the authenticated browser suite.
 *
 * Deliberately has NO `webServer` block: the default config would auto-start `npm run dev`,
 * which proxies to the normal backend on :5000. This suite must only ever talk to the
 * isolated in-memory-DB server, so the dev server is started manually with
 * VITE_PROXY_TARGET pointing at it and baseURL is pinned to that instance.
 *
 *   node backend/scripts/testServer.js
 *   VITE_PROXY_TARGET=http://localhost:5099 npx vite --port 5174
 *   npx playwright test -c playwright.auth.config.js
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'authenticated.spec.js',
  timeout: 120000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
