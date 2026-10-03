import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.ARTFLOW_E2E_BASE_URL || 'http://127.0.0.1:5373';
const studioURL = new URL(baseURL);
if (studioURL.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(studioURL.hostname)) {
  throw new Error('Automatic E2E startup requires a loopback HTTP URL; use playwright.reuse.local.ts for a running remote stack');
}
const studioPort = studioURL.port || '80';
const corePort = process.env.ARTFLOW_E2E_CORE_PORT || '3300';
const mockPort = process.env.ARTFLOW_E2E_MOCK_PORT || '3302';
for (const port of [studioPort, corePort, mockPort]) {
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('E2E ports must be between 1 and 65535');
}

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
    baseURL,
    locale: 'zh-CN',
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
      'ARTFLOW_STUDIO_DIR="${ARTFLOW_STUDIO_DIR:-$PWD}" bash "${ARTFLOW_CORE_DIR:-../Artflow-core}/scripts/dev/dev-stack.sh"'
      + ` --fixture --prod --studio-port ${studioPort} --core-port ${corePort} --mock-port ${mockPort}`,
    url: baseURL,
    reuseExistingServer: false,
    // dev-stack.sh traps SIGTERM and tears down its process groups (mock/core/studio)
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    timeout: 180000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
