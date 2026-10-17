import { expect, test, type Page } from '@playwright/test'

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285'
const OBRA = 'a1'

const relatorio = (id: string, competencia: string, conteudo: string) => ({
  id, obraId: OBRA, competencia, conteudo, status: 'published',
  publishedAt: '2026-03-02T15:00:00Z', createdAt: '2026-03-01T12:00:00Z',
})

async function entrarComoCliente(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('khazobras.session', JSON.stringify({
      token: 'token-sintetico', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      userId: '00000000-0000-0000-0000-000000000001', name: 'Cliente Teste', email: 'cliente@example.com', role: 'Client',
    }))
  })
}

test('cliente lê os relatórios publicados, do mês mais novo ao mais antigo, sem ações de escrita', async ({ page }) => {
  const auth: string[] = []
  await page.route(`${API}/**`, (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'GET' && url.pathname === `/obras/${OBRA}/relatorios-mensais`) {
      auth.push(req.headers().authorization ?? '')
      return route.fulfill({
        json: [
          relatorio('r1', '2026-02-01', 'Fundação concluída.'),
          relatorio('r2', '2026-03-01', 'Telhado em andamento.'),
        ],
      })
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${url.pathname}` } })
  })
  await entrarComoCliente(page)

  await page.goto(`/cliente/obras/${OBRA}/relatorio-mensal`)
  await expect(page.getByText('Telhado em andamento.')).toBeVisible()
  await expect(page.getByText('Fundação concluída.')).toBeVisible()
  const meses = await page.getByText(/de 2026$/i).allTextContents()
  expect(meses.map((m) => m.toLowerCase())).toEqual(['março de 2026', 'fevereiro de 2026'])
  await expect(page.getByRole('button', { name: /criar|novo|editar|excluir|publicar/i })).toHaveCount(0)
  expect(auth[0]).toBe('Bearer token-sintetico')
})

test('cliente sem vínculo com a obra recebe 403 e não vê relatórios', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }))
  await entrarComoCliente(page)

  await page.goto('/cliente/obras/outra/relatorio-mensal')
  await expect(page.getByRole('alert')).toContainText('não tem permissão')
  await expect(page.getByText(/Publicado em/)).toHaveCount(0)
})
