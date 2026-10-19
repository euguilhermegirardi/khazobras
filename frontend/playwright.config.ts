import { release } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

// e2e dos fluxos críticos (CLAUDE.md). Arquivos *.e2e.ts para o Vitest não os coletar.
// Navegador: Chromium. No macOS 13 (Darwin 22, o Mac de desenvolvimento) o Playwright 1.64 não baixa navegadores,
// então usa o Google Chrome instalado (channel "chrome"). Variáveis:
//   PW_CHANNEL=chrome|msedge   força um navegador instalado     PW_BROWSER=webkit   WebKit onde houver suporte
//   PW_CHROMIUM_PATH=...       outro executável Chromium (ex.: nuvem, revisão diferente da esperada)
const browser = process.env.PW_BROWSER ?? 'chromium';
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const macOS13 = process.platform === 'darwin' && release().startsWith('22.');
const channel = process.env.PW_CHANNEL || (macOS13 && !executablePath ? 'chrome' : undefined);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    browser === 'chromium'
      ? { name: 'chromium', use: { ...devices['Desktop Chrome'], channel, launchOptions: { executablePath } } }
      : { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
