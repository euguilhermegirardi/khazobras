import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285';
const OBRA = 'a1';
const APPROVER = '77777777-7777-7777-7777-777777777777';

type Status = 'PendingApproval' | 'Approved' | 'InvoiceIssued';

interface Item {
  id: string;
  tipo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface Medicao {
  id: string;
  obraId: string;
  etapaId: string | null;
  numero: number;
  competencia: string;
  valorTotal: number;
  status: Status;
  approvedAt: string | null;
  nfNumber: string | null;
  nfIssuedAt: string | null;
  createdAt: string;
  itens: Item[];
}

const medicao = (id: string, numero: number, status: Status, over: Partial<Medicao> = {}): Medicao => ({
  id,
  obraId: OBRA,
  etapaId: null,
  numero,
  competencia: '2026-08-01',
  valorTotal: 355,
  status,
  approvedAt: status === 'PendingApproval' ? null : '2026-09-25T15:00:00Z',
  nfNumber: null,
  nfIssuedAt: null,
  createdAt: '2026-08-10T15:00:00Z',
  itens: [
    {
      id: `${id}-i1`,
      tipo: 'Material',
      descricao: 'Cimento CP-II',
      quantidade: 10,
      valorUnitario: 35.5,
      valorTotal: 355,
    },
  ],
  ...over,
});

const resumoDe = (m: Medicao, etapaNome: string | null = null) => ({
  id: m.id,
  obraId: m.obraId,
  etapaId: m.etapaId,
  etapaNome,
  numero: m.numero,
  competencia: m.competencia,
  valorTotal: m.valorTotal,
  status: m.status,
  quantidadeItens: m.itens.length,
  createdAt: m.createdAt,
  approvedAt: m.approvedAt,
  nfIssuedAt: m.nfIssuedAt,
  nfNumber: m.nfNumber,
});

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
  postsMedicao: { auth: string; body: Record<string, unknown> }[];
  postsNf: { id: string; auth: string; body: Record<string, unknown> }[];
  resumos: number;
}

/** API em memória: a lista e o detalhe refletem o que foi criado/emitido. */
async function mockApi(page: Page, opcoes: { erroNf?: { status: number; json: unknown } } = {}) {
  const estado: Medicao[] = [
    medicao('m2', 2, 'Approved', { competencia: '2026-09-01' }),
    medicao('m1', 1, 'PendingApproval'),
  ];
  const chamadas: Chamadas = { postsMedicao: [], postsNf: [], resumos: 0 };
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const metodo = req.method();
    if (metodo === 'GET' && path === `/obras/${OBRA}/etapas`) {
      return route.fulfill({
        json: [
          {
            id: 'e1',
            obraId: OBRA,
            nome: 'Fundação',
            ordem: 1,
            percentualPeso: 10,
            dataInicioPrevista: '2026-03-01',
            dataFimPrevista: '2026-04-30',
            dataInicioReal: null,
            dataFimReal: null,
            status: 'nao_iniciada',
            percentualConcluido: 0,
            createdAt: '2026-01-10T12:00:00Z',
          },
        ],
      });
    }
    if (metodo === 'GET' && path === `/obras/${OBRA}/medicoes/resumo`) {
      const status = url.searchParams.get('status');
      const mapa: Record<string, Status> = {
        pending_approval: 'PendingApproval',
        approved: 'Approved',
        invoice_issued: 'InvoiceIssued',
      };
      const filtradas = status ? estado.filter((m) => m.status === mapa[status]) : estado;
      const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
      if (pageSize !== 1) chamadas.resumos += 1;
      return route.fulfill({
        json: {
          totalItems: filtradas.length,
          pageIndex: 0,
          pageSize,
          items: filtradas.slice(0, pageSize).map((m) => resumoDe(m)),
        },
      });
    }
    const detalhe = /^\/medicoes\/([^/]+)$/.exec(path);
    if (metodo === 'GET' && detalhe) {
      const m = estado.find((x) => x.id === detalhe[1]);
      if (!m) return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: { ...m, approvedByUserId: APPROVER } });
    }
    if (metodo === 'POST' && path === '/medicoes') {
      const body = req.postDataJSON() as Record<string, unknown> & {
        numero: number;
        competencia: string;
        etapaId: string | null;
        itens: { tipo: string; descricao: string; quantidade: number; valorUnitario: number }[];
      };
      chamadas.postsMedicao.push({ auth: req.headers().authorization ?? '', body });
      const itens: Item[] = body.itens.map((i, n) => ({
        id: `n${n}`,
        tipo: i.tipo === 'mao_de_obra' ? 'MaoDeObra' : i.tipo === 'equipamento' ? 'Equipamento' : 'Material',
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        valorTotal: Math.round(i.quantidade * i.valorUnitario * 100) / 100,
      }));
      const nova = medicao('m3', body.numero, 'PendingApproval', {
        competencia: body.competencia,
        etapaId: body.etapaId,
        itens,
        valorTotal: itens.reduce((s, i) => s + i.valorTotal, 0),
      });
      estado.unshift(nova);
      return route.fulfill({ status: 201, json: { ...nova, approvedByUserId: null } });
    }
    const nf = /^\/medicoes\/([^/]+)\/issue-invoice$/.exec(path);
    if (metodo === 'POST' && nf) {
      const body = req.postDataJSON() as { nfNumber: string };
      chamadas.postsNf.push({ id: nf[1] ?? '', auth: req.headers().authorization ?? '', body });
      if (opcoes.erroNf) return route.fulfill(opcoes.erroNf);
      const indice = estado.findIndex((x) => x.id === nf[1]);
      const atual = estado[indice] as Medicao;
      const emitida: Medicao = {
        ...atual,
        status: 'InvoiceIssued',
        nfNumber: body.nfNumber,
        nfIssuedAt: '2026-10-19T15:00:00Z',
      };
      estado[indice] = emitida;
      return route.fulfill({ json: { ...emitida, approvedByUserId: APPROVER } });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  });
  return chamadas;
}

test('admin cria uma medição: POST no formato do backend, diálogo fecha e a lista mostra a nova', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/medicoes`);
  await expect(page.getByRole('heading', { name: 'Medições' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir medição 2' })).toBeVisible();

  await page.getByRole('button', { name: '+ Nova medição' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova medição' });
  await expect(dialog.getByLabel('Número')).toHaveValue('3');
  await dialog.getByLabel('Competência (mês)').fill('2026-10');
  await expect(dialog.getByRole('option', { name: 'Fundação' })).toBeAttached();
  await dialog.getByLabel('Etapa (opcional)').selectOption({ label: 'Fundação' });
  await dialog.getByLabel('Tipo do item 1').selectOption({ label: 'Mão de obra' });
  await dialog.getByLabel('Descrição do item 1').fill('Pedreiro (diária)');
  await dialog.getByLabel('Quantidade do item 1').fill('2,5');
  await dialog.getByLabel('Valor unitário do item 1').fill('150');
  await expect(dialog.getByText('Total do item 1').locator('..')).toContainText('375,00');
  await dialog.getByRole('button', { name: 'Criar medição' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Medição 3 criada.' })).toBeVisible();
  expect(chamadas.postsMedicao).toHaveLength(1);
  expect(chamadas.postsMedicao[0]?.auth).toBe('Bearer token-sintetico');
  expect(chamadas.postsMedicao[0]?.body).toEqual({
    obraId: OBRA,
    etapaId: 'e1',
    numero: 3,
    competencia: '2026-10-01',
    itens: [{ tipo: 'mao_de_obra', descricao: 'Pedreiro (diária)', quantidade: 2.5, valorUnitario: 150 }],
  });
  const nova = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Abrir medição 3' }) });
  await expect(nova).toContainText('Aguardando aprovação do cliente');
  await expect(nova).toContainText('375,00');
});

test('erro 409 de número repetido aparece no campo número e nada é criado na tela', async ({ page }) => {
  await mockApi(page);
  await page.route(`${API}/medicoes`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 409, json: { message: 'Já existe a medição 3 nesta obra.' } })
      : route.fallback(),
  );
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/medicoes`);
  await page.getByRole('button', { name: '+ Nova medição' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova medição' });
  await dialog.getByLabel('Descrição do item 1').fill('Item');
  await dialog.getByLabel('Valor unitário do item 1').fill('10');
  await dialog.getByRole('button', { name: 'Criar medição' }).click();

  await expect(dialog.getByLabel('Número')).toHaveAccessibleDescription('Já existe a medição 3 nesta obra.');
  await expect(dialog).toBeVisible();
});

test('admin emite a NF de uma medição aprovada: POST com o número, tela passa a mostrar a NF', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/medicoes`);
  await page.getByRole('link', { name: 'Abrir medição 2' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/medicoes/m2`);
  await expect(page.getByRole('heading', { name: 'Medição 2' })).toBeVisible();
  await expect(page.getByText(/Aprovada pelo cliente em 25\/09\/2026/)).toBeVisible();

  await page.getByRole('button', { name: 'Emitir NF' }).click();
  const dialog = page.getByRole('dialog', { name: 'Emitir NF' });
  await dialog.getByLabel('Número da NF').fill('  NF-2026-0100  ');
  await dialog.getByRole('button', { name: 'Emitir NF' }).click();

  await expect(dialog).toHaveCount(0);
  expect(chamadas.postsNf).toEqual([{ id: 'm2', auth: 'Bearer token-sintetico', body: { nfNumber: 'NF-2026-0100' } }]);
  await expect(page.getByText('NF NF-2026-0100 emitida.')).toBeVisible();
  await expect(page.getByText(/NF nº NF-2026-0100, emitida em 19\/10\/2026/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Emitir NF' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(APPROVER);

  await page.getByRole('link', { name: /Voltar para as medições/ }).click();
  const linha = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Abrir medição 2' }) });
  await expect(linha).toContainText('NF-2026-0100');
  await expect(linha).toContainText('NF emitida');
});

test('medição aguardando aprovação não tem ação: admin não aprova nem emite NF', async ({ page }) => {
  await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/medicoes/m1`);
  await expect(page.getByRole('heading', { name: 'Medição 1' })).toBeVisible();
  await expect(page.getByText(/só é liberada depois que o cliente aprovar/)).toBeVisible();
  await expect(page.getByRole('button', { name: /emitir nf|aprovar/i })).toHaveCount(0);
});

test('erro 500 ao emitir NF mostra o código de suporte e o diálogo continua aberto', async ({ page }) => {
  await mockApi(page, {
    erroNf: { status: 500, json: { requestId: 'req-e2e-nf', message: 'Erro interno do servidor.' } },
  });
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/medicoes/m2`);
  await page.getByRole('button', { name: 'Emitir NF' }).click();
  const dialog = page.getByRole('dialog', { name: 'Emitir NF' });
  await dialog.getByLabel('Número da NF').fill('NF-1');
  await dialog.getByRole('button', { name: 'Emitir NF' }).click();

  await expect(dialog.getByRole('alert')).toContainText('req-e2e-nf');
  await expect(dialog).toBeVisible();
});

test('"Medições" está na sidebar do admin e leva à lista da obra', async ({ page }) => {
  await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}`);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Medições' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/medicoes`);
});

test('cliente é barrado na lista e no detalhe do admin e nenhuma medição é pedida', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Client');

  await page.goto(`/admin/obras/${OBRA}/medicoes`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await page.goto(`/admin/obras/${OBRA}/medicoes/m2`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /nova medição|emitir nf|aprovar/i })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(chamadas.resumos).toBe(0);
});

test('deslogado em /admin vai para o login', async ({ page }) => {
  await mockApi(page);

  await page.goto(`/admin/obras/${OBRA}/medicoes`);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
