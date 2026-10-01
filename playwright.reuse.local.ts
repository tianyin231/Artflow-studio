import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '/tmp/artflow-pw-report' }]],
  timeout: 60000,
  outputDir: '/tmp/artflow-pw-results',
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
});
