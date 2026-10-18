import { expect, test, type Page } from '@playwright/test'

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285'
const OBRA = 'a1'

// PDF mínimo válido (uma página em branco) e PNG 1x1
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R/Size 4>>\n%%EOF\n',
)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const projeto = (id: string, nome: string, etapaId: string | null, tipoDocumento: string | null = null) => ({
  id, obraId: OBRA, etapaId, nome, tipoDocumento, uploadedAt: '2026-03-10T15:00:00Z',
})

async function entrarComoCliente(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('khazobras.session', JSON.stringify({
      token: 'token-sintetico', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      userId: '00000000-0000-0000-0000-000000000001', name: 'Cliente Teste', email: 'cliente@example.com', role: 'Client',
    }))
  })
}

async function mockApi(page: Page, auth: string[]) {
  await page.route(`${API}/**`, (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'GET' && url.pathname === `/obras/${OBRA}/projetos`) {
      return route.fulfill({
        json: [
          projeto('p1', 'Planta de locação.pdf', 'e1', 'Planta baixa'),
          projeto('p2', 'Detalhe das sapatas.png', 'e1'),
          projeto('p3', 'Quantitativo.xlsx', 'e1', 'Planilha'),
          projeto('p4', 'Memorial descritivo.pdf', null, 'Memorial'),
        ],
      })
    }
    if (req.method() === 'GET' && url.pathname === `/obras/${OBRA}/etapas`) {
      return route.fulfill({ json: [{ id: 'e1', obraId: OBRA, nome: 'Fundação', ordem: 1 }] })
    }
    const dl = url.pathname.match(/^\/projetos\/([^/]+)\/download$/)
    if (req.method() === 'GET' && dl) {
      auth.push(req.headers().authorization ?? '')
      if (dl[1] === 'p2') return route.fulfill({ body: PNG, contentType: 'image/png' })
      return route.fulfill({
        body: PDF,
        contentType: 'application/pdf',
        // O backend expõe Content-Disposition no CORS (WithExposedHeaders); o mock precisa fazer o mesmo.
        headers: {
          'Content-Disposition': `attachment; filename="arquivo-${dl[1]}.pdf"`,
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
      })
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${url.pathname}` } })
  })
}

test('cliente vê projetos agrupados por etapa e baixa um arquivo com Bearer', async ({ page }) => {
  const auth: string[] = []
  await mockApi(page, auth)
  await entrarComoCliente(page)

  await page.goto(`/cliente/obras/${OBRA}/projetos`)
  await expect(page.getByRole('heading', { name: 'Fundação' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Documentos gerais' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Visualizar Quantitativo.xlsx' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /enviar|upload|criar|novo|editar|excluir/i })).toHaveCount(0)

  // linhas com e sem "Visualizar" têm a mesma altura
  const alturas = await page.getByRole('row').evaluateAll((rows) =>
    rows.filter((r) => r.querySelector('td')).map((r) => Math.round(r.getBoundingClientRect().height)),
  )
  expect(new Set(alturas).size).toBe(1)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar Planta de locação.pdf' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('arquivo-p1.pdf')
  expect(auth).toEqual(['Bearer token-sintetico'])
})

test('Visualizar abre uma nova página que carrega o PDF', async ({ page, context }) => {
  const auth: string[] = []
  await mockApi(page, auth)
  await entrarComoCliente(page)
  await page.goto(`/cliente/obras/${OBRA}/projetos`)

  const novaPagina = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Visualizar Planta de locação.pdf' }).click()
  const aba = await novaPagina
  await aba.waitForLoadState('domcontentloaded')

  expect(aba.url()).toMatch(/^blob:/)
  const conteudo = await aba.evaluate(async () => {
    const r = await fetch(location.href)
    const b = await r.blob()
    return { tipo: b.type, tamanho: b.size, inicio: await b.slice(0, 5).text() }
  })
  expect(conteudo.tipo).toBe('application/pdf')
  expect(conteudo.inicio).toBe('%PDF-')
  expect(auth).toEqual(['Bearer token-sintetico'])
})

test('Visualizar abre uma nova página que carrega a imagem', async ({ page, context }) => {
  await mockApi(page, [])
  await entrarComoCliente(page)
  await page.goto(`/cliente/obras/${OBRA}/projetos`)

  const novaPagina = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Visualizar Detalhe das sapatas.png' }).click()
  const aba = await novaPagina
  await aba.waitForLoadState('load')

  expect(aba.url()).toMatch(/^blob:/)
  await expect(aba.locator('img')).toHaveCount(1)
  const natural = await aba.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)
  expect(natural).toBeGreaterThan(0)
})

test('cliente sem vínculo com a obra recebe 403 e não vê documentos', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }))
  await entrarComoCliente(page)

  await page.goto('/cliente/obras/outra/projetos')
  await expect(page.getByRole('alert')).toContainText('não tem permissão')
  await expect(page.getByRole('table')).toHaveCount(0)
})
