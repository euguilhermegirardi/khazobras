import { expect, test, type Page } from '@playwright/test'

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285'
const OBRA = 'a1'

const foto = (id: string, ordem: number) => ({
  id, dataFoto: '2026-03-10', descricao: `Foto ${id}`, ordem, createdAt: '2026-04-01T12:00:00Z',
})

// PNG 1x1
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function entrarComoCliente(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('khazobras.session', JSON.stringify({
      token: 'token-sintetico', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      userId: '00000000-0000-0000-0000-000000000001', name: 'Cliente Teste', email: 'cliente@example.com', role: 'Client',
    }))
  })
}

test('cliente vê as fotos do relatório, só por blob: e com Bearer, sem ações de escrita', async ({ page }) => {
  const auth: string[] = []
  await page.route(`${API}/**`, (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'GET' && url.pathname === `/obras/${OBRA}/relatorios-fotograficos`) {
      return route.fulfill({
        json: [{
          id: 'rf1', obraId: OBRA, tipo: 'mensal', etapaId: null, titulo: 'Março', competencia: '2026-03-01',
          createdAt: '2026-04-01T12:00:00Z', fotos: [foto('f1', 1), foto('f2', 2)],
        }],
      })
    }
    if (req.method() === 'GET' && url.pathname === `/obras/${OBRA}/etapas`) return route.fulfill({ json: [] })
    if (req.method() === 'GET' && /^\/fotos\/[^/]+\/arquivo$/.test(url.pathname)) {
      auth.push(req.headers().authorization ?? '')
      return route.fulfill({ body: PNG, contentType: 'image/png' })
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${url.pathname}` } })
  })
  await entrarComoCliente(page)

  await page.goto(`/cliente/obras/${OBRA}/relatorio-fotografico`)
  await expect(page.getByRole('heading', { name: 'Março de 2026' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ampliar foto: Foto f1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ampliar foto: Foto f2' })).toBeVisible()

  for (const img of await page.getByRole('img').all()) {
    expect(await img.getAttribute('src')).toMatch(/^blob:/)
  }
  expect(auth.length).toBeGreaterThanOrEqual(2)
  expect(auth.every((h) => h === 'Bearer token-sintetico')).toBe(true)

  await page.getByRole('button', { name: 'Ampliar foto: Foto f1' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(page.getByRole('button', { name: /enviar|upload|criar|novo|editar|excluir/i })).toHaveCount(0)
})

test('cliente sem vínculo com a obra recebe 403 e não vê fotos', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }))
  await entrarComoCliente(page)

  await page.goto('/cliente/obras/outra/relatorio-fotografico')
  await expect(page.getByRole('alert')).toContainText('não tem permissão')
  await expect(page.getByRole('button', { name: /Ampliar foto/ })).toHaveCount(0)
})
