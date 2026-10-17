import { defineConfig, devices } from '@playwright/test'

// e2e dos fluxos críticos (CLAUDE.md). Arquivos *.e2e.ts para o Vitest não os coletar.
// Navegador: Chromium (o Playwright atual não oferece WebKit no macOS 13, o Mac de desenvolvimento).
// PW_BROWSER=webkit roda no WebKit onde houver suporte. PW_CHROMIUM_PATH aponta outro Chromium (ex.: nuvem,
// quando a revisão instalada difere da esperada pelo Playwright).
const browser = process.env.PW_BROWSER ?? 'chromium'
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    browser === 'chromium'
      ? { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } }
      : { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
