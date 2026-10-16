import { expect, test, type Page } from '@playwright/test'

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285'
const OBRA = 'a1'

const pendente = {
  id: 'm3', obraId: OBRA, etapaId: null, numero: 3, competencia: '2026-03-01', valorTotal: 450,
  status: 'PendingApproval', approvedAt: null, nfNumber: null, nfIssuedAt: null, createdAt: '2026-03-28T12:00:00Z',
  itens: [{ id: 'i1', tipo: 'Equipamento', descricao: 'Betoneira 400 L (diária)', quantidade: 5, valorUnitario: 90, valorTotal: 450 }],
}

async function entrarComoCliente(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('khazobras.session', JSON.stringify({
      token: 'token-sintetico', expiresAt: new Date(Date.now() + 3600e3).toISOString(),
      userId: '00000000-0000-0000-0000-000000000001', name: 'Cliente Teste', email: 'cliente@example.com', role: 'Client',
    }))
  })
}

test('cliente revisa a medição pendente e a aprova com confirmação', async ({ page }) => {
  let atual: typeof pendente | (Omit<typeof pendente, 'status' | 'approvedAt'> & { status: string; approvedAt: string }) = pendente
  const posts: string[] = []
  await page.route(`${API}/**`, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const key = `${req.method()} ${path}`
    if (key === `GET /obras/${OBRA}/medicoes`) return route.fulfill({ json: [atual] })
    if (key === 'GET /medicoes/m3') return route.fulfill({ json: atual })
    if (key === 'POST /medicoes/m3/approve') {
      posts.push(req.headers().authorization ?? '')
      atual = { ...pendente, status: 'Approved', approvedAt: '2026-04-01T15:00:00Z' }
      return route.fulfill({ json: atual })
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${key}` } })
  })
  await entrarComoCliente(page)

  await page.goto(`/cliente/obras/${OBRA}/fechamento`)
  await expect(page.getByText('Você tem 1 medição aguardando sua aprovação.')).toBeVisible()
  await page.getByRole('link', { name: 'Ver itens da medição 3' }).click()

  await expect(page.getByRole('heading', { name: 'Medição 3' })).toBeVisible()
  await expect(page.getByText('Betoneira 400 L (diária)')).toBeVisible()

  await page.getByRole('button', { name: 'Aprovar medição' }).click()
  await expect(page.getByText('Confirmar aprovação da medição 3?')).toBeVisible()
  expect(posts).toHaveLength(0)
  await page.getByRole('button', { name: 'Confirmar aprovação' }).click()

  await expect(page.getByText(/Você aprovou esta medição em/)).toBeVisible()
  await expect(page.getByRole('button', { name: /aprovar/i })).toHaveCount(0)
  expect(posts).toEqual(['Bearer token-sintetico'])
})

test('cliente sem vínculo com a obra recebe 403 e não vê medições', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }))
  await entrarComoCliente(page)

  await page.goto('/cliente/obras/outra/fechamento')
  await expect(page.getByRole('alert')).toContainText('não tem permissão')
  await expect(page.getByRole('table')).toHaveCount(0)
})
