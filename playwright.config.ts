import { defineConfig } from '@playwright/test';
const deployedUrl = process.env.ENGRAVE_TEST_URL;
const testProxy = process.env.ENGRAVE_TEST_PROXY;
export default defineConfig({
  outputDir: deployedUrl ? 'test-results/deployed' : 'test-results/local',
  testDir: './tests', workers: 1, timeout: 60000,
  use: { baseURL: deployedUrl || 'http://127.0.0.1:5176',
    ...(testProxy ? { proxy: { server: testProxy } } : {}),
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: deployedUrl ? undefined : { command: 'npm run preview -- --host 127.0.0.1 --port 5176 --strictPort', url: 'http://127.0.0.1:5176', reuseExistingServer: false },
});
