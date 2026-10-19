import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285';
const OBRA = 'a1';

const obra = {
  id: OBRA,
  nome: 'Residencial Aurora',
  endereco: 'Rua Exemplo, 100',
  status: 'EmAndamento',
  valorContratado: 552055,
  dataInicio: '2025-02-03',
  dataPrevisaoTermino: '2026-09-30',
};

type Etapa = {
  id: string;
  obraId: string;
  nome: string;
  ordem: number;
  percentualPeso: number;
  dataInicioPrevista: string | null;
  dataFimPrevista: string | null;
  dataInicioReal: string | null;
  dataFimReal: string | null;
  status: string;
  percentualConcluido: number;
  createdAt: string;
};

const etapa = (id: string, nome: string, ordem: number, over: Partial<Etapa> = {}): Etapa => ({
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
  percentualConcluido: 0,
  createdAt: '2026-01-10T12:00:00Z',
  ...over,
});

const cenario = (): Etapa[] => [
  etapa('e1', 'Fundação', 1, {
    status: 'concluida',
    percentualConcluido: 100,
    dataInicioReal: '2026-03-02',
    dataFimReal: '2026-04-28',
  }),
  etapa('e2', 'Alvenaria', 2, {
    percentualPeso: 30,
    status: 'em_andamento',
    percentualConcluido: 40,
    dataInicioPrevista: '2026-05-01',
    dataFimPrevista: '2026-12-31',
    dataInicioReal: '2026-05-05',
  }),
  etapa('e3', 'Telhado', 3, { dataInicioPrevista: '2027-01-01', dataFimPrevista: '2027-02-15' }),
];

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
  gets: number;
  puts: { id: string; auth: string; body: Record<string, unknown> }[];
  posts: Record<string, unknown>[];
}

/** API em memória: GET lista as etapas atuais, PUT aplica no estado (ou devolve `erroPut`), POST acrescenta. */
async function mockApi(page: Page, opcoes: { erroPut?: { status: number; json: unknown } } = {}) {
  const estado: Etapa[] = cenario();
  const chamadas: Chamadas = { gets: 0, puts: [], posts: [] };
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const metodo = req.method();
    if (metodo === 'GET' && path === '/obras') {
      return route.fulfill({ json: { totalItems: 1, pageIndex: 0, pageSize: 50, items: [obra] } });
    }
    if (metodo === 'GET' && path === `/obras/${OBRA}/etapas`) {
      chamadas.gets += 1;
      return route.fulfill({ json: estado });
    }
    if (metodo === 'PUT' && path.startsWith('/etapas/')) {
      const id = path.split('/').pop() ?? '';
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.puts.push({ id, auth: req.headers().authorization ?? '', body });
      if (opcoes.erroPut) return route.fulfill(opcoes.erroPut);
      const indice = estado.findIndex((e) => e.id === id);
      const atual = estado[indice] as Etapa;
      const atualizada = { ...atual, ...body } as Etapa;
      estado[indice] = atualizada;
      return route.fulfill({ json: atualizada });
    }
    if (metodo === 'POST' && path === '/etapas') {
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.posts.push(body);
      const nova = etapa(`e${estado.length + 1}`, String(body.nome), Number(body.ordem), {
        percentualPeso: Number(body.percentualPeso),
        dataInicioPrevista: (body.dataInicioPrevista as string | null) ?? null,
        dataFimPrevista: (body.dataFimPrevista as string | null) ?? null,
      });
      estado.push(nova);
      return route.fulfill({ status: 201, json: nova });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  });
  return chamadas;
}

test('admin vai do hub ao Gantt editável pela obra e volta por "← Meus projetos"', async ({ page }) => {
  await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Meus projetos' })).toBeVisible();
  await page.getByRole('link', { name: /Residencial Aurora/ }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}`);

  await page.getByRole('link', { name: 'Gantt editável' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/gantt`);
  await expect(page.getByRole('heading', { name: 'Gantt editável' })).toBeVisible();
  const linhas = page.getByRole('row');
  await expect(linhas).toHaveCount(4); // cabeçalho + 3 etapas
  await expect(page.getByRole('button', { name: '+ Etapa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar etapa Alvenaria' })).toBeVisible();
  await expect(page.getByRole('button', { name: /exclu|remov|apagar/i })).toHaveCount(0);

  await page.getByRole('main').getByRole('link', { name: 'Meus projetos' }).click();
  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('heading', { name: 'Meus projetos' })).toBeVisible();
});

test('admin edita o avanço de uma etapa: PUT com o corpo completo, fecha o diálogo e a tabela atualiza', async ({
  page,
}) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await page.getByRole('button', { name: 'Editar etapa Alvenaria' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar etapa' });
  await expect(dialog.getByLabel('Nome da etapa')).toHaveValue('Alvenaria');
  await expect(dialog.getByLabel('Status')).toHaveValue('em_andamento');

  await dialog.getByLabel('% concluído').fill('100');
  await expect(dialog.getByLabel('Status')).toHaveValue('concluida'); // sugestão pelo %
  await dialog.getByLabel('Fim real').fill('2026-11-20');
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Etapa "Alvenaria" atualizada.' })).toBeVisible();
  expect(chamadas.puts).toHaveLength(1);
  expect(chamadas.puts[0]?.id).toBe('e2');
  expect(chamadas.puts[0]?.auth).toBe('Bearer token-sintetico');
  expect(chamadas.puts[0]?.body).toEqual({
    nome: 'Alvenaria',
    ordem: 2,
    percentualPeso: 30,
    dataInicioPrevista: '2026-05-01',
    dataFimPrevista: '2026-12-31',
    dataInicioReal: '2026-05-05',
    dataFimReal: '2026-11-20',
    status: 'concluida',
    percentualConcluido: 100,
  });
  // refez o GET e a linha reflete o novo estado
  await expect.poll(() => chamadas.gets).toBeGreaterThanOrEqual(2);
  const linha = page.getByRole('row').filter({ hasText: 'Alvenaria' });
  await expect(linha.getByText('Concluída')).toBeVisible();
  await expect(linha.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
});

test('erro 400 do servidor aparece no campo e o diálogo continua aberto', async ({ page }) => {
  const chamadas = await mockApi(page, {
    erroPut: {
      status: 400,
      json: {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { Nome: ['Já existe uma etapa com este nome.'] },
      },
    },
  });
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await page.getByRole('button', { name: 'Editar etapa Telhado' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar etapa' });
  await dialog.getByLabel('Nome da etapa').fill('Fundação');
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialog.getByLabel('Nome da etapa')).toHaveAccessibleDescription('Já existe uma etapa com este nome.');
  await expect(dialog.getByLabel('Nome da etapa')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(chamadas.puts).toHaveLength(1);
});

test('validação local barra o envio: concluída sem 100% não chega ao servidor', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await page.getByRole('button', { name: 'Editar etapa Alvenaria' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar etapa' });
  await dialog.getByLabel('Status').selectOption('concluida');
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialog.getByLabel('% concluído')).toHaveAccessibleDescription(/100%/);
  await expect(dialog.getByLabel('Fim real')).toHaveAccessibleDescription(/concluída/i);
  expect(chamadas.puts).toHaveLength(0);
});

test('erro 500 no PUT mostra o código de suporte no diálogo', async ({ page }) => {
  await mockApi(page, {
    erroPut: { status: 500, json: { requestId: 'req-e2e-500', message: 'Erro interno do servidor.' } },
  });
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await page.getByRole('button', { name: 'Editar etapa Alvenaria' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar etapa' });
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialog.getByRole('alert')).toContainText('req-e2e-500');
  await expect(dialog).toBeVisible();
});

test('admin cria uma etapa com a próxima ordem: POST só com os campos previstos', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Master');

  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await page.getByRole('button', { name: '+ Etapa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova etapa' });
  await expect(dialog.getByLabel('Ordem')).toHaveValue('4');
  await expect(dialog.getByLabel('Status')).toHaveCount(0);
  await dialog.getByLabel('Nome da etapa').fill('Instalações');
  await dialog.getByLabel('Peso (%)').fill('15');
  await dialog.getByLabel('Início previsto').fill('2027-03-01');
  await dialog.getByLabel('Fim previsto').fill('2027-04-15');
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialog).toHaveCount(0);
  expect(chamadas.posts).toEqual([
    {
      obraId: OBRA,
      nome: 'Instalações',
      ordem: 4,
      percentualPeso: 15,
      dataInicioPrevista: '2027-03-01',
      dataFimPrevista: '2027-04-15',
    },
  ]);
  await expect(page.getByRole('button', { name: 'Editar etapa Instalações' })).toBeVisible();
});

test('cliente é barrado no hub e no Gantt do admin e nenhuma etapa é pedida', async ({ page }) => {
  const chamadas = await mockApi(page);
  await entrarComo(page, 'Client');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Etapa/ })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(chamadas.gets).toBe(0);
});

test('deslogado em /admin vai para o login', async ({ page }) => {
  await mockApi(page);

  await page.goto(`/admin/obras/${OBRA}/gantt`);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
