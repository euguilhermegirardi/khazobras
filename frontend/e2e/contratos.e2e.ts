import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos. Visão do CLIENTE: somente leitura.
const API = 'http://localhost:5285';
const OBRA = 'a1';

const contrato = (id: string, numero: string, over: Record<string, unknown> = {}) => ({
  id,
  obraId: OBRA,
  numero,
  valorContratado: 100000,
  dataAssinatura: '2026-03-02',
  totalPago: 40000,
  saldoAPagar: 60000,
  ...over,
});

const C1 = contrato('c1', 'CT-2026/01', { valorContratado: 180000, totalPago: 192500.5, saldoAPagar: -12500.5 });
const C2 = contrato('c2', 'CT-2026/02', { valorContratado: 85000, totalPago: 30000, saldoAPagar: 55000 });

const P1 = {
  id: 'p1',
  referenteMedicaoId: 'm4',
  referenteMedicaoNumero: 4,
  valor: 62500.5,
  dataPagamento: '2026-09-10',
  formaPagamento: 'TED',
};
const P2 = {
  id: 'p2',
  referenteMedicaoId: null,
  referenteMedicaoNumero: null,
  valor: 50000,
  dataPagamento: '2026-04-02',
  formaPagamento: null,
};
const P3 = {
  id: 'p3',
  referenteMedicaoId: 'm3',
  referenteMedicaoNumero: 3,
  valor: 30000,
  dataPagamento: '2026-09-25',
  formaPagamento: 'Pix',
};

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

test('cliente vê os contratos, os totais e os pagamentos, tudo somente leitura', async ({ page }) => {
  const pedidos: string[] = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    pedidos.push(`${req.method()} ${path}`);
    if (req.method() === 'GET' && path === `/obras/${OBRA}/contratos`) {
      // Se o backend vazasse campos internos, a tela não pode mostrá-los (regra 7).
      return route.fulfill({ json: [{ ...C1, createdAt: '2031-05-06T07:08:09Z', custoReal: 987654.32 }, C2] });
    }
    if (req.method() === 'GET' && path === '/contratos/c1') {
      return route.fulfill({ json: { ...C1, pagamentos: [P1, P2] } });
    }
    if (req.method() === 'GET' && path === '/contratos/c2') {
      return route.fulfill({ json: { ...C2, pagamentos: [P3] } });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${path}` } });
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/contratos`);
  await expect(page.getByRole('heading', { name: 'Contratos', level: 1 })).toBeVisible();

  // Totais da obra (2 contratos): 265.000 contratado, 222.500,50 pago, saldo 42.499,50 a pagar.
  await expect(page.getByText('Valor contratado total')).toBeVisible();
  await expect(page.getByText('Valor contratado total').locator('..')).toContainText('265.000,00');
  await expect(page.getByText('Total pago').locator('..')).toContainText('222.500,50');
  await expect(page.getByText('Saldo a pagar', { exact: true }).first()).toBeVisible();

  const c1 = page.getByRole('group', { name: 'Contrato CT-2026/01' });
  await expect(c1).toContainText('Assinado em 02/03/2026');
  await expect(c1.getByText('Pago a mais')).toBeVisible();
  await expect(c1.getByText('Pago a mais').locator('..')).toContainText('12.500,50');
  await expect(c1.getByText('Pago a mais').locator('..')).not.toContainText('-');
  await expect(c1.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

  const linhas = c1.getByRole('row');
  await expect(linhas).toHaveCount(3);
  await expect(linhas.nth(1)).toContainText('10/09/2026');
  await expect(linhas.nth(1)).toContainText('Medição nº 4');
  await expect(linhas.nth(2)).toContainText('02/04/2026');
  await expect(linhas.nth(2)).not.toContainText('Medição nº');
  await expect(linhas.nth(2)).toContainText('—');

  const c2 = page.getByRole('group', { name: 'Contrato CT-2026/02' });
  await expect(c2.getByText('Saldo a pagar')).toBeVisible();
  await expect(c2.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '35');

  // Sidebar: depois de Financeiro e antes de Relatório fotográfico; item ativo.
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const nomes = (await nav.getByRole('link').allTextContents()).map((t) => t.trim());
  const i = nomes.indexOf('Contratos');
  expect(nomes[i - 1]).toBe('Financeiro');
  expect(nomes[i + 1]).toBe('Relatório fotográfico');
  await expect(nav.getByRole('link', { name: 'Contratos' })).toHaveAttribute('aria-current', 'page');

  // Somente leitura e sem dado interno.
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('987.654');
  await expect(page.locator('body')).not.toContainText('2031');
  expect(pedidos.every((p) => p.startsWith('GET '))).toBe(true);
});

test('erro 500 no detalhe de um contrato fica no card e "Tentar novamente" recupera', async ({ page }) => {
  let falhar = true;
  await page.route(`${API}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/obras/${OBRA}/contratos`) return route.fulfill({ json: [C1, C2] });
    if (path === '/contratos/c1') return route.fulfill({ json: { ...C1, pagamentos: [P1, P2] } });
    if (path === '/contratos/c2') {
      if (falhar) {
        return route.fulfill({
          status: 500,
          json: { requestId: 'req-e2e-detalhe', message: 'Erro interno do servidor.' },
        });
      }
      return route.fulfill({ json: { ...C2, pagamentos: [P3] } });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${path}` } });
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/contratos`);
  const secao = page.getByRole('region', { name: 'Pagamentos do contrato CT-2026/02' });
  await expect(secao.getByRole('alert')).toContainText('req-e2e-detalhe');
  await expect(page.getByRole('group', { name: 'Contrato CT-2026/01' }).getByRole('table')).toBeVisible();

  falhar = false;
  await secao.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(secao.getByRole('table')).toContainText('25/09/2026');
});

test('obra sem contratos mostra o vazio', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ json: [] }));
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/contratos`);
  await expect(page.getByText('Nenhum contrato registrado para esta obra')).toBeVisible();
});

test('cliente sem vínculo com a obra recebe 403 e não vê contratos', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }));
  await entrarComoCliente(page);

  await page.goto('/cliente/obras/outra/contratos');
  await expect(page.getByRole('alert')).toContainText('não tem permissão');
  await expect(page.getByRole('group')).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('cliente é barrado na tela de contratos do admin e nada é pedido à API', async ({ page }) => {
  let chamadas = 0;
  await page.route(`${API}/**`, (route) => {
    chamadas += 1;
    return route.fulfill({ status: 501, json: {} });
  });
  await entrarComoCliente(page);

  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /novo contrato|registrar pagamento/i })).toHaveCount(0);
  expect(chamadas).toBe(0);
});
