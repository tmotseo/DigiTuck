import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'node --import tsx scripts/test-server.ts', url: 'http://127.0.0.1:4173/api/v1/health/live', reuseExistingServer: false, env: { NODE_ENV: 'test' } },
  projects: [{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } }, { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 360, height: 800 } } }]
})

