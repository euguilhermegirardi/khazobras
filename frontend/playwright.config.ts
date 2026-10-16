import { defineConfig, devices } from '@playwright/test'

// e2e dos fluxos críticos (CLAUDE.md). Arquivos *.e2e.ts para o Vitest não os coletar.
// Navegador: PLAN-09 decidiu WebKit; no ambiente de nuvem só há Chromium, então PW_BROWSER=chromium
// (e PW_CHROMIUM_PATH, se a revisão instalada diferir da esperada pelo Playwright) troca só para rodar lá.
const browser = process.env.PW_BROWSER ?? 'webkit'
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
