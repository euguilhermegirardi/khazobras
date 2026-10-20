import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos. Visão do ADMIN: criar contrato e registrar pagamento.
const API = 'http://localhost:5285';
const OBRA = 'a1';

interface Pagamento {
  id: string;
  contratoId: string;
  referenteMedicaoId: string | null;
  referenteMedicaoNumero: number | null;
  valor: number;
  dataPagamento: string;
  formaPagamento: string | null;
  createdAt: string;
}

interface Contrato {
  id: string;
  obraId: string;
  numero: string;
  valorContratado: number;
  dataAssinatura: string | null;
  totalPago: number;
  saldoAPagar: number;
  createdAt: string;
  updatedAt: string;
}

const MEDICAO_NF = {
  id: 'm4',
  obraId: OBRA,
  etapaId: null,
  etapaNome: null,
  numero: 4,
  competencia: '2026-08-01',
  valorTotal: 51890.25,
  status: 'InvoiceIssued',
  quantidadeItens: 5,
  createdAt: '2026-08-27T15:00:00Z',
  approvedAt: '2026-09-01T15:00:00Z',
  nfIssuedAt: '2026-09-05T15:00:00Z',
  nfNumber: 'NF-2026-0187',
};

async function entrarComo(page: Page, role: 'Admin' | 'Master' | 'Client') {
  await page.addInitScript((papel) => {
    sessionStorage.setItem(
      'khazobras.session',
      JSON.stringify({
        token: 'token-sintetico',
        expiresAt: new Date(Date.now() + 3600e3).toISOString(),
        userId: '00000000-0000-0000-0000-000000000001',
        name: `Usuário ${papel}`,
        email: `${papel.toLowerCase()}@example.com`,
        role: papel,
      }),
    );
  }, role);
}

interface Chamadas {
  postsContrato: { auth: string; body: Record<string, unknown> }[];
  postsPagamento: { id: string; auth: string; body: Record<string, unknown> }[];
  medicoes: string[];
  semMock: string[];
}

/** API em memória: a lista e o detalhe refletem o que foi criado/registrado; totais recalculados como no backend. */
async function mockApi(page: Page) {
  const contratos: Contrato[] = [];
  const pagamentos: Record<string, Pagamento[]> = {};
  const chamadas: Chamadas = { postsContrato: [], postsPagamento: [], medicoes: [], semMock: [] };

  const recalcular = (c: Contrato) => {
    const total = (pagamentos[c.id] ?? []).reduce((soma, p) => soma + Math.round(p.valor * 100), 0) / 100;
    c.totalPago = total;
    c.saldoAPagar = (Math.round(c.valorContratado * 100) - Math.round(total * 100)) / 100;
  };

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const metodo = req.method();
    const auth = req.headers().authorization ?? '';

    if (metodo === 'GET' && path === `/obras/${OBRA}/contratos`) return route.fulfill({ json: contratos });
    const detalhe = /^\/contratos\/([^/]+)$/.exec(path);
    if (metodo === 'GET' && detalhe) {
      const c = contratos.find((x) => x.id === detalhe[1]);
      if (!c) return route.fulfill({ status: 404, json: {} });
      const lista = (pagamentos[c.id] ?? []).map((p) => ({
        ...p,
        referenteMedicaoNumero: p.referenteMedicaoId === MEDICAO_NF.id ? MEDICAO_NF.numero : null,
      }));
      return route.fulfill({ json: { ...c, pagamentos: lista } });
    }
    if (metodo === 'GET' && path === `/obras/${OBRA}/medicoes/resumo`) {
      chamadas.medicoes.push(url.search);
      return route.fulfill({ json: { totalItems: 1, pageIndex: 0, pageSize: 100, items: [MEDICAO_NF] } });
    }
    if (metodo === 'POST' && path === '/contratos') {
      const body = req.postDataJSON() as Record<string, unknown> & {
        numero: string;
        valorContratado: number;
        dataAssinatura: string | null;
      };
      chamadas.postsContrato.push({ auth, body });
      const novo: Contrato = {
        id: `c${contratos.length + 1}`,
        obraId: OBRA,
        numero: body.numero,
        valorContratado: body.valorContratado,
        dataAssinatura: body.dataAssinatura,
        totalPago: 0,
        saldoAPagar: body.valorContratado,
        createdAt: '2026-10-20T12:00:00Z',
        updatedAt: '2026-10-20T12:00:00Z',
      };
      contratos.push(novo);
      pagamentos[novo.id] = [];
      return route.fulfill({ status: 201, json: novo });
    }
    const postPag = /^\/contratos\/([^/]+)\/pagamentos$/.exec(path);
    if (metodo === 'POST' && postPag) {
      const id = postPag[1] ?? '';
      const body = req.postDataJSON() as Record<string, unknown> & {
        valor: number;
        dataPagamento: string;
        formaPagamento: string | null;
        referenteMedicaoId: string | null;
      };
      chamadas.postsPagamento.push({ id, auth, body });
      const c = contratos.find((x) => x.id === id);
      if (!c) return route.fulfill({ status: 404, json: {} });
      const novo: Pagamento = {
        id: `p${chamadas.postsPagamento.length}`,
        contratoId: id,
        referenteMedicaoId: body.referenteMedicaoId,
        referenteMedicaoNumero: null,
        valor: body.valor,
        dataPagamento: body.dataPagamento,
        formaPagamento: body.formaPagamento,
        createdAt: '2026-10-20T12:00:00Z',
      };
      pagamentos[id] = [novo, ...(pagamentos[id] ?? [])];
      recalcular(c);
      return route.fulfill({ status: 201, json: novo });
    }
    chamadas.semMock.push(`${metodo} ${path}`);
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  });
  return chamadas;
}

test('admin cria um contrato e registra um pagamento ligado a uma medição com NF', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await expect(page.getByRole('heading', { name: 'Contratos', level: 1 })).toBeVisible();
  await expect(page.getByText('Nenhum contrato registrado nesta obra ainda')).toBeVisible();

  // Criar contrato.
  await page.getByRole('button', { name: '+ Novo contrato' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo contrato' });
  await novo.getByLabel('Número do contrato').fill('  CT-2026/01  ');
  await novo.getByLabel('Valor contratado (R$)').fill('125000,55');
  await novo.getByLabel('Data de assinatura (opcional)').fill('2026-03-15');
  await novo.getByRole('button', { name: 'Criar contrato' }).click();

  await expect(novo).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Contrato CT-2026/01 criado.' })).toBeVisible();
  expect(chamadas.postsContrato).toHaveLength(1);
  expect(chamadas.postsContrato[0]?.auth).toBe('Bearer token-sintetico');
  expect(chamadas.postsContrato[0]?.body).toEqual({
    obraId: OBRA,
    numero: 'CT-2026/01',
    valorContratado: 125000.55,
    dataAssinatura: '2026-03-15',
  });
  const card = page.getByRole('group', { name: 'Contrato CT-2026/01' });
  await expect(card).toContainText('Assinado em 15/03/2026');
  await expect(card.getByText('Saldo a pagar').locator('..')).toContainText('125.000,55');
  await expect(card).toContainText('Nenhum pagamento registrado neste contrato ainda.');

  // Registrar pagamento ligado à medição nº 4.
  expect(chamadas.medicoes).toHaveLength(0);
  await card.getByRole('button', { name: 'Registrar pagamento no contrato CT-2026/01' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar pagamento' });
  await expect(dialog.getByRole('option', { name: /Medição nº 4 — Agosto de 2026 — R\$\s*51\.890,25/ })).toBeAttached();
  // No dev o StrictMode pode repetir o GET; o que importa é o filtro pedido ao servidor.
  expect(chamadas.medicoes.length).toBeGreaterThan(0);
  expect(new Set(chamadas.medicoes)).toEqual(new Set(['?status=invoice_issued&pageIndex=0&pageSize=100']));
  await dialog.getByLabel('Valor (R$)').fill('5500,50');
  await dialog.getByLabel('Data do pagamento').fill('2026-10-05');
  await dialog.getByLabel('Forma de pagamento (opcional)').fill('TED');
  await dialog.getByLabel('Medição vinculada (opcional)').selectOption({ value: 'm4' });
  await dialog.getByRole('button', { name: 'Registrar pagamento' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Pagamento de R$ 5.500,50 registrado no contrato CT-2026/01.')).toBeVisible();
  expect(chamadas.postsPagamento).toEqual([
    {
      id: 'c1',
      auth: 'Bearer token-sintetico',
      body: { valor: 5500.5, dataPagamento: '2026-10-05', formaPagamento: 'TED', referenteMedicaoId: 'm4' },
    },
  ]);
  const linha = card.getByRole('row').nth(1);
  await expect(linha).toContainText('05/10/2026');
  await expect(linha).toContainText('Medição nº 4');
  await expect(linha).toContainText('TED');
  await expect(card.getByText('Pago', { exact: true }).locator('..')).toContainText('5.500,50');
  await expect(card.getByText('Saldo a pagar').locator('..')).toContainText('119.500,05');
  expect(chamadas.semMock).toEqual([]);
});

test('número repetido (409) aparece no campo e o diálogo continua aberto', async ({ page }) => {
  await mockApi(page);
  await page.route(`${API}/contratos`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 409, json: { message: 'Ja existe um contrato com este numero nesta obra.' } })
      : route.fallback(),
  );
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await page.getByRole('button', { name: '+ Novo contrato' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo contrato' });
  await dialog.getByLabel('Número do contrato').fill('CT-2026/01');
  await dialog.getByLabel('Valor contratado (R$)').fill('1000');
  await dialog.getByRole('button', { name: 'Criar contrato' }).click();

  await expect(dialog.getByLabel('Número do contrato')).toHaveAccessibleDescription(
    'Ja existe um contrato com este numero nesta obra.',
  );
  await expect(dialog).toBeVisible();
});

test('erro 500 ao registrar pagamento mostra o código de suporte e mantém o diálogo aberto', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');
  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await page.getByRole('button', { name: '+ Novo contrato' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo contrato' });
  await novo.getByLabel('Número do contrato').fill('CT-9');
  await novo.getByLabel('Valor contratado (R$)').fill('1000');
  await novo.getByRole('button', { name: 'Criar contrato' }).click();
  await expect(novo).toHaveCount(0);

  await page.route(`${API}/contratos/c1/pagamentos`, (route) =>
    route.fulfill({ status: 500, json: { requestId: 'req-e2e-pag', message: 'Erro interno do servidor.' } }),
  );
  await page.getByRole('button', { name: 'Registrar pagamento no contrato CT-9' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar pagamento' });
  await dialog.getByLabel('Valor (R$)').fill('100');
  await dialog.getByRole('button', { name: 'Registrar pagamento' }).click();

  await expect(dialog.getByRole('alert')).toContainText('req-e2e-pag');
  await expect(dialog).toBeVisible();
  expect(chamadas.postsPagamento).toHaveLength(0);
});

test('validação local: valor com 3 casas decimais é recusado e não chega ao servidor', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');
  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await page.getByRole('button', { name: '+ Novo contrato' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo contrato' });
  await novo.getByLabel('Número do contrato').fill('CT-1');
  await novo.getByLabel('Valor contratado (R$)').fill('10,123');
  await novo.getByRole('button', { name: 'Criar contrato' }).click();
  await expect(novo.getByLabel('Valor contratado (R$)')).toHaveAttribute('aria-invalid', 'true');
  expect(chamadas.postsContrato).toHaveLength(0);
});

test('"Contratos" está na sidebar do admin depois de "Financeiro" (Medições, Financeiro, Contratos) e leva à tela da obra', async ({
  page,
}) => {
  await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/medicoes/x`);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const nomes = (await nav.getByRole('link').allTextContents()).map((t) => t.trim());
  const i = nomes.indexOf('Contratos');
  expect(nomes.slice(i - 2, i + 1)).toEqual(['Medições', 'Financeiro', 'Contratos']);
  await nav.getByRole('link', { name: 'Contratos' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/contratos`);
});

test('cliente é barrado na tela do admin e nenhum contrato é pedido', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Client');

  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /novo contrato|registrar pagamento/i })).toHaveCount(0);
  expect(chamadas.postsContrato).toHaveLength(0);
  expect(chamadas.medicoes).toHaveLength(0);
});

test('deslogado em /admin vai para o login', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/admin/obras/${OBRA}/contratos`);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
