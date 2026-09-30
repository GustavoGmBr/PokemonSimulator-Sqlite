import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', timeout: 90_000, fullyParallel: false, workers: 1, retries: 0,
  use: { baseURL: process.env.POKEMON_SIMULATOR_WEB_URL || 'http://127.0.0.1:35185', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
