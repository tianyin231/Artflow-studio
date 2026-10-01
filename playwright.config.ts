import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E — runs against the production fixture stack started by
 * Artflow-core's `scripts/dev/dev-stack.sh --fixture --prod` on 127.0.0.1:5373.
 * Core checkout: $ARTFLOW_CORE_DIR, defaults to the sibling ../Artflow-core.
 * To reuse an already running stack: npx playwright test -c playwright.reuse.local.ts
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60000,
  use: {
    baseURL: process.env.ARTFLOW_E2E_BASE_URL || 'http://127.0.0.1:5373',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'ARTFLOW_STUDIO_DIR="${ARTFLOW_STUDIO_DIR:-$PWD}" bash "${ARTFLOW_CORE_DIR:-../Artflow-core}/scripts/dev/dev-stack.sh" --fixture --prod',
    url: 'http://127.0.0.1:5373',
    reuseExistingServer: false,
    // dev-stack.sh traps SIGTERM and tears down its process groups (mock/core/studio)
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    timeout: 180000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
