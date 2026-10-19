// Captura uma tela do frontend com a API simulada, para comparar com docs/design/capturas/.
// Uso (na raiz do repo; um comando só, sem `&&`/`&` — é o que a execução noturna libera):
//   node scripts/capturar-tela.mjs --rota /cliente --papel Client --mocks frontend/e2e/mocks/hub.json --saida capturas/hub
//     → capturas/hub.png (claro 1440), capturas/hub-escuro.png, capturas/hub-1280.png
//   --so-uma  → só a captura indicada em --saida (com --tema/--largura), sem as variantes.
// Se o front não estiver no ar em --base, o script sobe `npm run dev` em frontend/, espera e derruba no fim.
// mocks: JSON { "GET /obras": <corpo>, "GET /obras/123/medicoes": { "status": 500, "body": {...} } }
//   Imagem (ex.: foto baixada pela API): "GET /fotos/f1/arquivo": { "imagem": true } → PNG sintético.
//   Chave com * casa qualquer trecho: "GET /fotos/*/arquivo".
// Requer Playwright (`@playwright/test`, instalado com o e2e). Dados sintéticos apenas.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { release } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (!cur.startsWith('--')) return acc;
    const prox = arr[i + 1];
    return [...acc, [cur.slice(2), prox === undefined || prox.startsWith('--') ? 'true' : prox]];
  }, []),
);
const base = (args.base ?? 'http://localhost:5173').replace(/\/$/, '');
const api = (args.api ?? 'http://localhost:5285').replace(/\/$/, '');
const rota = args.rota ?? '/';
const papel = args.papel; // Client | Admin | Master (sem papel = deslogado)
const saidaArg = (args.saida ?? 'tela').replace(/\.png$/, '');
const mocks = args.mocks ? JSON.parse(readFileSync(args.mocks, 'utf8')) : {};

const variantes = args['so-uma']
  ? [{ arquivo: `${saidaArg}.png`, tema: args.tema ?? 'light', largura: Number(args.largura ?? 1440) }]
  : [
      { arquivo: `${saidaArg}.png`, tema: 'light', largura: 1440 },
      { arquivo: `${saidaArg}-escuro.png`, tema: 'dark', largura: 1440 },
      { arquivo: `${saidaArg}-1280.png`, tema: 'light', largura: 1280 },
    ];

const noAr = async () => {
  try {
    const r = await fetch(base, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
};

let dev = null;
if (!(await noAr())) {
  console.log(`Front fora do ar em ${base}; subindo npm run dev em frontend/ ...`);
  const porta = new URL(base).port || '5173';
  dev = spawn('npm', ['run', 'dev', '--', '--port', porta, '--strictPort'], {
    cwd: join(process.cwd(), 'frontend'),
    stdio: 'ignore',
    detached: true,
  });
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ok = await noAr();
  }
  if (!ok) {
    try {
      process.kill(-dev.pid);
    } catch {}
    console.error('Não consegui subir o front em 60s.');
    process.exit(2);
  }
}
const derrubar = () => {
  if (dev) {
    try {
      process.kill(-dev.pid);
    } catch {}
  }
};

const require = createRequire(join(process.cwd(), 'frontend/package.json'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');

// Navegador: no macOS 13 (Darwin 22) o Playwright 1.64 não baixa navegadores → usa o Google Chrome instalado.
const macOS13 = process.platform === 'darwin' && release().startsWith('22.');
const channel = process.env.PW_CHANNEL || (macOS13 ? 'chrome' : undefined);
const opcoes = channel ? { channel } : {};
if (process.env.PW_CHROMIUM_PATH) opcoes.executablePath = process.env.PW_CHROMIUM_PATH;
const naoMockadas = new Set();
// PNG sintético 16x12 cinza-azulado (serve de foto nos mocks).
const PNG_SINTETICO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAIAAADkharWAAAAFUlEQVR42mPYsO8oSYhhVMOoBuwIAPxoplBOylVDAAAAAElFTkSuQmCC',
  'base64',
);
const acharMock = (chave) => {
  if (mocks[chave] !== undefined) return mocks[chave];
  const curinga = Object.keys(mocks).find(
    (k) =>
      k.includes('*') &&
      new RegExp(
        `^${k
          .split('*')
          .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^/]+')}$`,
      ).test(chave),
  );
  return curinga === undefined ? undefined : mocks[curinga];
};

try {
  const browser = await chromium.launch(opcoes);
  for (const v of variantes) {
    const page = await browser.newPage({ viewport: { width: v.largura, height: 900 }, colorScheme: v.tema });
    await page.route(`${api}/**`, (route) => {
      const url = new URL(route.request().url());
      const chave = `${route.request().method()} ${url.pathname}`;
      const mock = acharMock(chave);
      if (mock && typeof mock === 'object' && mock.imagem === true) {
        return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_SINTETICO });
      }
      if (mock === undefined) {
        naoMockadas.add(chave);
        return route.fulfill({ status: 501, json: { message: `sem mock: ${chave}` } });
      }
      const temStatus = mock && typeof mock === 'object' && 'status' in mock && 'body' in mock;
      return route.fulfill({ status: temStatus ? mock.status : 200, json: temStatus ? mock.body : mock });
    });
    if (papel) {
      await page.addInitScript((role) => {
        sessionStorage.setItem(
          'khazobras.session',
          JSON.stringify({
            token: 'token-sintetico',
            expiresAt: new Date(Date.now() + 3600e3).toISOString(),
            userId: '00000000-0000-0000-0000-000000000001',
            name: `Usuário ${role}`,
            email: 'teste@example.com',
            role,
          }),
        );
      }, papel);
    }
    await page.goto(base + rota, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    mkdirSync(dirname(v.arquivo) || '.', { recursive: true });
    await page.screenshot({ path: v.arquivo, fullPage: true });
    await page.close();
    console.log(`Captura salva em ${v.arquivo} (${v.tema}, ${v.largura}px)`);
  }
  await browser.close();
} finally {
  derrubar();
}
if (naoMockadas.size) console.warn('Chamadas sem mock (responderam 501):', [...naoMockadas].join(', '));
