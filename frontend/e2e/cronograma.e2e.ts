import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285';
const OBRA = 'a1';

const etapa = (id: string, nome: string, ordem: number, over: Record<string, unknown> = {}) => ({
  id,
  obraId: OBRA,
  nome,
  ordem,
  percentualPeso: 10,
  dataInicioPrevista: '2026-03-01',
  dataFimPrevista: '2026-04-30',
  dataInicioReal: null,
  dataFimReal: null,
  status: 'nao_iniciada',
  createdAt: '2026-01-10T12:00:00Z',
  ...over,
});

async function entrarComoCliente(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'khazobras.session',
      JSON.stringify({
        token: 'token-sintetico',
        expiresAt: new Date(Date.now() + 3600e3).toISOString(),
        userId: '00000000-0000-0000-0000-000000000001',
        name: 'Cliente Teste',
        email: 'cliente@example.com',
        role: 'Client',
      }),
    );
  });
}

test('cliente vê a linha do tempo com KPIs, barras acessíveis e sem ações de escrita', async ({ page }) => {
  const auth: string[] = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'GET' && path === `/obras/${OBRA}/etapas`) {
      auth.push(req.headers().authorization ?? '');
      return route.fulfill({
        json: [
          etapa('e1', 'Fundação', 1, { status: 'concluida', dataInicioReal: '2026-03-02', dataFimReal: '2026-04-28' }),
          etapa('e2', 'Alvenaria', 2, { dataInicioPrevista: '2026-05-01', dataFimPrevista: '2026-12-31' }),
          etapa('e3', 'Pintura', 3, { dataInicioPrevista: null, dataFimPrevista: null }),
        ],
      });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${path}` } });
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/cronograma`);
  await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Fundação: previsto de 01/03/2026 a 30/04/2026, Concluída' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Fundação: realizado de 02/03/2026 a 28/04/2026' })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Alvenaria: previsto de 01/05/2026 a 31/12/2026, Não iniciada' }),
  ).toBeVisible();
  await expect(page.getByText('Sem datas previstas')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Linha do tempo das etapas' }).getByText('Dez/26')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cronograma' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByText(/curva s/i)).toHaveCount(0);
  expect(auth[0]).toBe('Bearer token-sintetico');
});

test('obra sem etapas mostra a mensagem de cronograma não cadastrado', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ json: [] }));
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/cronograma`);
  await expect(page.getByText('O cronograma desta obra ainda não foi cadastrado')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Linha do tempo das etapas' })).toHaveCount(0);
});

test('cliente sem vínculo com a obra recebe 403 e não vê etapas', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }));
  await entrarComoCliente(page);

  await page.goto('/cliente/obras/outra/cronograma');
  await expect(page.getByRole('alert')).toContainText('não tem permissão');
  await expect(page.getByRole('img')).toHaveCount(0);
});
