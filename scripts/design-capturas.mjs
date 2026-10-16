// Regenera as capturas de referência a partir de docs/design/referencia.html.
// Uso (na raiz): node scripts/design-capturas.mjs
// Requer Playwright (`@playwright/test`, instalado com o e2e do frontend). Sem internet para o CDN,
// passe VENDOR_DIR=<pasta com node_modules/chart.js e @tabler/icons-webfont>.
import { createRequire } from 'node:module'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const require = createRequire(join(process.cwd(), 'frontend/package.json'))
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test')
const raiz = process.cwd()
const ref = resolve(raiz, 'docs/design/referencia.html')
const saida = resolve(raiz, 'docs/design/capturas')
mkdirSync(saida, { recursive: true })

const TELAS = [
  ['hub', 'hub'], ['dashboard', 'dashboard'], ['kpis', 'kpis'], ['cronograma', 'cronograma'],
  ['rdo', 'rdo'], ['medicoes-dinamicas', 'medicoes'], ['financeiro', 'financeiro'],
  ['pagamentos', 'pagamentos'], ['contratos', 'contratos'], ['fornecedores', 'fornecedores'],
  ['relatorio-mensal', 'relatorio-cliente'], ['documentos', 'documentos'], ['admin', 'admin'],
]

const prepararRotas = async (page) => {
  const vendor = process.env.VENDOR_DIR
  if (!vendor) return
  const nm = join(vendor, 'node_modules')
  await page.route(/chart\.umd/, (r) => r.fulfill({ path: join(nm, 'chart.js/dist/chart.umd.js'), contentType: 'application/javascript' }))
  await page.route(/icons-webfont.*\/dist\/(.*)$/, (r) =>
    r.fulfill({ path: join(nm, '@tabler/icons-webfont/dist', r.request().url().split('/dist/')[1].split('?')[0]) }))
}

const browser = await chromium.launch()
for (const tema of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: tema, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.dismiss())
  await prepararRotas(page)
  await page.goto('file://' + ref, { waitUntil: 'load' })
  await page.evaluate(() => { const b = document.getElementById('sync-banner'); if (b) b.style.display = 'none' })
  const telas = tema === 'light' ? TELAS : TELAS.filter(([, n]) => n === 'dashboard')
  for (const [dataPage, nome] of telas) {
    await page.click(`.nav-item[data-page="${dataPage}"]`)
    if (dataPage === 'medicoes-dinamicas') {
      const opcoes = await page.$$eval('#med-select option', (os) => os.map((o) => o.value).filter(Boolean))
      if (opcoes[0]) await page.selectOption('#med-select', opcoes[0])
    }
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(saida, `${nome}${tema === 'dark' ? '-escuro' : ''}.png`), fullPage: true })
    if (dataPage === 'financeiro') {
      await page.click('.tab[data-fintab="lancamentos"]')
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(saida, 'financeiro-lancamentos.png') })
    }
  }
  if (tema === 'light') {
    // Página do cliente: o protótipo gera um HTML à parte (botão "gerar página do cliente").
    await page.click('.nav-item[data-page="relatorio-mensal"]')
    const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => window.gerarPaginaCliente())])
    const html = await (await download.createReadStream()).toArray()
    const arquivo = join(saida, '.cliente.tmp.html')
    writeFileSync(arquivo, Buffer.concat(html))
    const cli = await ctx.newPage()
    await prepararRotas(cli)
    await cli.goto('file://' + arquivo, { waitUntil: 'load' })
    await cli.waitForTimeout(500)
    await cli.screenshot({ path: join(saida, 'visao-cliente.png'), fullPage: true })
    rmSync(arquivo)
  }
  await ctx.close()
}
await browser.close()
console.log('Capturas em', saida)
