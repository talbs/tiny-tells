import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'node tests/serve.mjs 4173',
    url: 'http://127.0.0.1:4173/tests/fixture.html',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
