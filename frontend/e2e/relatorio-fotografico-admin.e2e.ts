import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos. Visão do ADMIN: criar relatório, enviar fotos,
// reordenar, editar, remover e excluir. O dev roda em StrictMode: GETs podem repetir, então só se contam escritas.
const API = 'http://localhost:5285';
const OBRA = 'a1';

// PNG 1x1
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

interface Foto {
  id: string;
  dataFoto: string | null;
  descricao: string | null;
  ordem: number;
  createdAt: string;
}

interface Relatorio {
  id: string;
  obraId: string;
  tipo: 'mensal' | 'etapa';
  etapaId: string | null;
  titulo: string;
  competencia: string | null;
  createdAt: string;
  fotos: Foto[];
}

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

const fotos = (n: number): Foto[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `f${i + 1}`,
    dataFoto: '2026-09-10',
    descricao: `Descrição ${i + 1}`,
    ordem: i,
    createdAt: `2026-09-11T12:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
  }));

interface Chamadas {
  criar: { auth: string; body: Record<string, unknown> }[];
  uploads: { auth: string; query: string; nome: string }[];
  ordem: unknown[];
  editarFoto: { id: string; body: Record<string, unknown> }[];
  removerFoto: string[];
  excluir: string[];
  arquivos: { auth: string }[];
  semMock: string[];
}

/** API em memória: o estado muda com as escritas e as leituras refletem. */
async function mockApi(page: Page, inicial: Relatorio[]) {
  const relatorios = structuredClone(inicial);
  const chamadas: Chamadas = {
    criar: [],
    uploads: [],
    ordem: [],
    editarFoto: [],
    removerFoto: [],
    excluir: [],
    arquivos: [],
    semMock: [],
  };
  let contador = 0;

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const metodo = req.method();
    const auth = req.headers().authorization ?? '';

    if (metodo === 'GET' && path === `/obras/${OBRA}/etapas`) {
      return route.fulfill({ json: [{ id: 'e1', obraId: OBRA, nome: 'Fundação', ordem: 1 }] });
    }
    if (metodo === 'GET' && path === `/obras/${OBRA}/relatorios-fotograficos`) {
      const lista = relatorios.map((r) => ({ ...r, quantidadeFotos: r.fotos.length }));
      return route.fulfill({ json: lista });
    }
    const detalhe = /^\/relatorios-fotograficos\/([^/]+)$/.exec(path);
    if (metodo === 'GET' && detalhe) {
      const r = relatorios.find((x) => x.id === detalhe[1]);
      return r
        ? route.fulfill({ json: { ...r, quantidadeFotos: r.fotos.length } })
        : route.fulfill({ status: 404, json: {} });
    }
    if (metodo === 'GET' && /^\/fotos\/[^/]+\/arquivo$/.test(path)) {
      chamadas.arquivos.push({ auth });
      return route.fulfill({ body: PNG, contentType: 'image/png' });
    }
    if (metodo === 'POST' && path === '/relatorios-fotograficos') {
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.criar.push({ auth, body });
      contador += 1;
      const novo: Relatorio = {
        id: `novo${contador}`,
        obraId: String(body.obraId),
        tipo: body.tipo as Relatorio['tipo'],
        etapaId: (body.etapaId as string | null) ?? null,
        titulo: String(body.titulo),
        competencia: (body.competencia as string | null) ?? null,
        createdAt: '2026-10-20T12:00:00Z',
        fotos: [],
      };
      relatorios.unshift(novo);
      return route.fulfill({ status: 201, json: novo });
    }
    const excluir = /^\/relatorios-fotograficos\/([^/]+)$/.exec(path);
    if (metodo === 'DELETE' && excluir) {
      chamadas.excluir.push(excluir[1] ?? '');
      const i = relatorios.findIndex((x) => x.id === excluir[1]);
      if (i >= 0) relatorios.splice(i, 1);
      return route.fulfill({ status: 204 });
    }
    const upload = /^\/relatorios-fotograficos\/([^/]+)\/fotos$/.exec(path);
    if (metodo === 'POST' && upload) {
      const r = relatorios.find((x) => x.id === upload[1]);
      if (!r) return route.fulfill({ status: 404, json: {} });
      const corpo = req.postDataBuffer()?.toString('latin1') ?? '';
      const nome = /filename="([^"]*)"/.exec(corpo)?.[1] ?? '';
      chamadas.uploads.push({ auth, query: url.search, nome });
      contador += 1;
      const nova: Foto = {
        id: `up${contador}`,
        dataFoto: url.searchParams.get('dataFoto'),
        descricao: url.searchParams.get('descricao'),
        ordem: r.fotos.length,
        createdAt: '2026-10-20T12:00:00Z',
      };
      r.fotos.push(nova);
      return route.fulfill({ status: 201, json: nova });
    }
    const ordem = /^\/relatorios-fotograficos\/([^/]+)\/fotos\/ordem$/.exec(path);
    if (metodo === 'PATCH' && ordem) {
      const r = relatorios.find((x) => x.id === ordem[1]);
      if (!r) return route.fulfill({ status: 404, json: {} });
      const body = req.postDataJSON() as { fotos: { id: string; ordem: number }[] };
      chamadas.ordem.push(body);
      for (const item of body.fotos) {
        const f = r.fotos.find((x) => x.id === item.id);
        if (f) f.ordem = item.ordem;
      }
      return route.fulfill({ json: [...r.fotos].sort((a, b) => a.ordem - b.ordem) });
    }
    const umaFoto = /^\/fotos\/([^/]+)$/.exec(path);
    if (metodo === 'PATCH' && umaFoto) {
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.editarFoto.push({ id: umaFoto[1] ?? '', body });
      const f = relatorios.flatMap((r) => r.fotos).find((x) => x.id === umaFoto[1]);
      if (!f) return route.fulfill({ status: 404, json: {} });
      if ('descricao' in body) f.descricao = body.descricao as string | null;
      if ('dataFoto' in body) f.dataFoto = body.dataFoto as string | null;
      return route.fulfill({ json: f });
    }
    if (metodo === 'DELETE' && umaFoto) {
      chamadas.removerFoto.push(umaFoto[1] ?? '');
      for (const r of relatorios) r.fotos = r.fotos.filter((x) => x.id !== umaFoto[1]);
      return route.fulfill({ status: 204 });
    }
    chamadas.semMock.push(`${metodo} ${path}`);
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  });
  return chamadas;
}

const setembro: Relatorio = {
  id: 'rf1',
  obraId: OBRA,
  tipo: 'mensal',
  etapaId: null,
  titulo: 'Relatório de setembro',
  competencia: '2026-09-01',
  createdAt: '2026-10-01T12:00:00Z',
  fotos: fotos(3),
};

test('admin cria um relatório, envia fotos, reordena, edita, remove uma foto e exclui o relatório', async ({
  page,
}) => {
  const chamadas = await mockApi(page, [setembro]);
  await entrarComo(page, 'Admin');

  // Lista e criação.
  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico`);
  await expect(page.getByRole('heading', { name: 'Relatório fotográfico', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Setembro de 2026', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: '+ Novo relatório' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo relatório fotográfico' });
  await novo.getByLabel('Tipo').selectOption('etapa');
  await novo.getByLabel('Etapa').selectOption({ label: 'Fundação' });
  await novo.getByLabel('Competência').fill('');
  await novo.getByLabel('Título').fill('Fundação concluída');
  await novo.getByRole('button', { name: 'Criar relatório' }).click();

  await expect(novo).toHaveCount(0);
  await expect(page.getByText('Relatório “Fundação concluída” criado.')).toBeVisible();
  expect(chamadas.criar).toHaveLength(1);
  expect(chamadas.criar[0]?.auth).toBe('Bearer token-sintetico');
  expect(chamadas.criar[0]?.body).toEqual({
    obraId: OBRA,
    tipo: 'etapa',
    etapaId: 'e1',
    titulo: 'Fundação concluída',
    competencia: null,
  });
  await expect(page.getByRole('heading', { name: 'Fundação', level: 2 })).toBeVisible();

  // Detalhe do relatório mensal de setembro.
  await page.getByRole('tab', { name: 'Mensal' }).click();
  await page.getByRole('link', { name: 'Gerenciar fotos: Setembro de 2026' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/relatorio-fotografico/rf1`);
  await expect(page.getByRole('heading', { name: 'Setembro de 2026', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ampliar foto: Descrição 1' })).toBeVisible();
  expect(chamadas.arquivos.length).toBeGreaterThanOrEqual(3);
  expect(chamadas.arquivos.every((a) => a.auth === 'Bearer token-sintetico')).toBe(true);
  for (const img of await page.getByRole('img').all()) {
    expect(await img.getAttribute('src')).toMatch(/^(blob:|$)/);
  }

  // Envio de duas fotos (recusa o PDF).
  await page.getByLabel(/Arraste as fotos aqui/).setInputFiles([
    { name: 'laje-1.png', mimeType: 'image/png', buffer: PNG },
    { name: 'laje-2.png', mimeType: 'image/png', buffer: PNG },
    { name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
  ]);
  await expect(page.getByText('documento.pdf: Só imagens são aceitas.', { exact: false })).toBeVisible();
  await page.getByLabel('Descrição do lote').fill('Laje do 2º pavimento');
  await page.getByLabel('Data das fotos').fill('2026-09-12');
  await page.getByRole('button', { name: 'Enviar 2 fotos' }).click();
  await expect(page.getByText('2 de 2 fotos enviadas')).toBeVisible();
  expect(chamadas.uploads.map((u) => u.nome)).toEqual(['laje-1.png', 'laje-2.png']);
  expect(chamadas.uploads.every((u) => u.auth === 'Bearer token-sintetico')).toBe(true);
  const query = new URLSearchParams(chamadas.uploads[0]?.query ?? '');
  expect(query.get('descricao')).toBe('Laje do 2º pavimento');
  expect(query.get('dataFoto')).toBe('2026-09-12');
  await expect(page.getByRole('heading', { name: 'Fotos', level: 2, exact: true }).locator('..')).toContainText(
    '5 de 100',
  );

  // Reordenar: a foto 2 vai para a esquerda; só as duas trocadas vão no lote.
  await page.getByRole('button', { name: 'Mover a foto 2 (Descrição 2) para a esquerda', exact: true }).click();
  await expect(page.getByText('Foto movida para a posição 1 de 5.')).toBeAttached();
  expect(chamadas.ordem).toEqual([
    {
      fotos: [
        { id: 'f2', ordem: 0 },
        { id: 'f1', ordem: 1 },
      ],
    },
  ]);
  // O foco vai para a seta oposta (a foto chegou ao começo).
  await expect(
    page.getByRole('button', { name: 'Mover a foto 1 (Descrição 2) para a direita', exact: true }),
  ).toBeFocused();

  // Editar a descrição da foto 3 (Descrição 3): só o campo mudado vai no PATCH.
  await page.getByRole('button', { name: 'Editar a foto 3 (Descrição 3)', exact: true }).click();
  const editar = page.getByRole('dialog', { name: 'Editar foto 3' });
  await editar.getByLabel('Descrição').fill('Pilar P3 concretado');
  await editar.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(editar).toHaveCount(0);
  expect(chamadas.editarFoto).toEqual([{ id: 'f3', body: { descricao: 'Pilar P3 concretado' } }]);
  await expect(page.getByText('Pilar P3 concretado', { exact: true })).toBeVisible();

  // Remover a foto 1 (a que acabou de ir para a direita é a f1, agora na posição 2).
  await page.getByRole('button', { name: 'Remover a foto 2 (Descrição 1)', exact: true }).click();
  await page
    .getByRole('group', { name: 'Confirmar a remoção da foto 2 (Descrição 1)' })
    .getByRole('button', { name: 'Remover' })
    .click();
  await expect(page.getByText('Foto removida.')).toBeVisible();
  expect(chamadas.removerFoto).toEqual(['f1']);
  await expect(page.getByRole('heading', { name: 'Fotos', level: 2, exact: true }).locator('..')).toContainText(
    '4 de 100',
  );

  // Excluir o relatório: confirmação com o número de fotos, depois volta à lista.
  await page.getByRole('button', { name: 'Excluir relatório' }).click();
  await expect(page.getByText('Excluir definitivamente este relatório e suas 4 fotos?')).toBeVisible();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/relatorio-fotografico`);
  await expect(page.getByRole('heading', { name: 'Relatório fotográfico', level: 1 })).toBeVisible();
  expect(chamadas.excluir).toEqual(['rf1']);
  await expect(page.getByRole('heading', { name: 'Setembro de 2026' })).toHaveCount(0);
  expect(chamadas.semMock).toEqual([]);
});

test('relatório com 100 fotos carrega as 100 miniaturas e bloqueia novos envios', async ({ page }) => {
  await mockApi(page, [{ ...setembro, fotos: fotos(100) }]);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico/rf1`);
  await expect(page.getByRole('button', { name: /^Ampliar foto:/ })).toHaveCount(100, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Fotos', level: 2, exact: true }).locator('..')).toContainText(
    '100 de 100',
  );
  await expect(page.getByLabel(/Limite de 100 fotos atingido/)).toBeDisabled();
});

test('relatório com 100 fotos não gera erro de renderização no console (miniaturas carregando juntas)', async ({
  page,
}) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  await mockApi(page, [{ ...setembro, fotos: fotos(100) }]);
  await entrarComo(page, 'Admin');

  // O erro é intermitente (depende de quantas miniaturas terminam no mesmo instante): carrega 4 vezes.
  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico/rf1`);
  for (let i = 0; i < 4; i++) {
    await expect(page.getByRole('button', { name: /^Ampliar foto:/ })).toHaveCount(100, { timeout: 20_000 });
    if (i < 3) await page.reload();
  }
  expect(erros).toEqual([]);
});

test('cliente é barrado nas telas do admin e nenhuma chamada é feita', async ({ page }) => {
  const chamadas = await mockApi(page, [setembro]);
  await entrarComo(page, 'Client');

  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /novo relatório|excluir|editar/i })).toHaveCount(0);

  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico/rf1`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByLabel(/Arraste as fotos aqui/)).toHaveCount(0);
  expect(chamadas.arquivos).toHaveLength(0);
  expect(chamadas.criar).toHaveLength(0);
});

test('relatório de outra obra na URL mostra "não encontrado nesta obra" e a API de outra obra (403) não vaza fotos', async ({
  page,
}) => {
  await mockApi(page, [{ ...setembro, id: 'rf-outra', obraId: 'b2' }]);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico/rf-outra`);
  await expect(page.getByText('Relatório não encontrado nesta obra.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ampliar foto:/ })).toHaveCount(0);

  await page.route(`${API}/relatorios-fotograficos/rf-bloqueado`, (route) => route.fulfill({ status: 403, body: '' }));
  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico/rf-bloqueado`);
  await expect(page.getByRole('alert')).toContainText('não tem permissão');
});

test('"Relatório fotográfico" aparece na sidebar do admin e leva à lista', async ({ page }) => {
  await mockApi(page, [setembro]);
  await entrarComo(page, 'Admin');

  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico/rf1`);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('link', { name: 'Relatório fotográfico' }).click();
  await expect(page).toHaveURL(`/admin/obras/${OBRA}/relatorio-fotografico`);
  await expect(page.getByRole('heading', { name: 'Setembro de 2026', level: 2 })).toBeVisible();
});

test('deslogado vai para o login', async ({ page }) => {
  await mockApi(page, [setembro]);
  await page.goto(`/admin/obras/${OBRA}/relatorio-fotografico`);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
