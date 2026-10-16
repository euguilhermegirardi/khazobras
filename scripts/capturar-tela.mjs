// Captura uma tela do frontend com a API simulada, para comparar com docs/design/capturas/.
// Uso (na raiz, com o front rodando: cd frontend && npm run dev):
//   node scripts/capturar-tela.mjs --rota /cliente --papel Client --mocks frontend/e2e/mocks/hub.json --saida /tmp/hub.png
// mocks: JSON { "GET /obras": <corpo>, "GET /obras/123/medicoes": { "status": 500, "body": {...} } }
// Requer Playwright (`@playwright/test`, instalado com o e2e). Dados sintéticos apenas.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => (cur.startsWith('--') ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), []),
)
const base = args.base ?? 'http://localhost:5173'
const api = (args.api ?? 'http://localhost:5285').replace(/\/$/, '')
const rota = args.rota ?? '/'
const papel = args.papel // Client | Admin | Master (sem papel = deslogado)
const saida = args.saida ?? 'tela.png'
const largura = Number(args.largura ?? 1440)
const mocks = args.mocks ? JSON.parse(readFileSync(args.mocks, 'utf8')) : {}

const require = createRequire(join(process.cwd(), 'frontend/package.json'))
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: largura, height: 900 }, colorScheme: args.tema ?? 'light' })
const naoMockadas = []

await page.route(`${api}/**`, (route) => {
  const url = new URL(route.request().url())
  const chave = `${route.request().method()} ${url.pathname}`
  const mock = mocks[chave]
  if (mock === undefined) {
    naoMockadas.push(chave)
    return route.fulfill({ status: 501, json: { message: `sem mock: ${chave}` } })
  }
  const temStatus = mock && typeof mock === 'object' && 'status' in mock && 'body' in mock
  return route.fulfill({ status: temStatus ? mock.status : 200, json: temStatus ? mock.body : mock })
})

if (papel) {
  await page.addInitScript((role) => {
    sessionStorage.setItem('khazobras.session', JSON.stringify({
      token: 'token-sintetico', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      userId: '00000000-0000-0000-0000-000000000001', name: `Usuário ${role}`, email: 'teste@example.com', role,
    }))
  }, papel)
}

await page.goto(base + rota, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.screenshot({ path: saida, fullPage: true })
await browser.close()
if (naoMockadas.length) console.warn('Chamadas sem mock (responderam 501):', [...new Set(naoMockadas)].join(', '))
console.log('Captura salva em', saida)
