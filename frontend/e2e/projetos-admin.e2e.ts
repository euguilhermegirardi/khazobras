import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos. Visão do ADMIN: listar, enviar, editar e
// excluir documentos de projeto. O dev roda em StrictMode: GETs podem repetir, então só se contam escritas.
const API = 'http://localhost:5285';
const OBRA = 'a1';
const ROTA = `/admin/obras/${OBRA}/projetos`;

// PDF mínimo e PNG 1x1
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R/Size 2>>\n%%EOF\n');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

interface Projeto {
  id: string;
  obraId: string;
  etapaId: string | null;
  nome: string;
  tipoDocumento: string | null;
  uploadedAt: string;
}

const ETAPAS = [
  { id: 'e1', obraId: OBRA, nome: 'Fundação', ordem: 1 },
  { id: 'e2', obraId: OBRA, nome: 'Alvenaria', ordem: 2 },
];

const projeto = (id: string, nome: string, etapaId: string | null, tipoDocumento: string | null = null): Projeto => ({
  id,
  obraId: OBRA,
  etapaId,
  nome,
  tipoDocumento,
  uploadedAt: '2026-03-10T15:00:00Z',
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
  uploads: { auth: string; search: string; nome: string }[];
  editar: { id: string; auth: string; body: Record<string, unknown> }[];
  excluir: { id: string; auth: string }[];
  leituras: number;
  semMock: string[];
}

/** Ordem do backend: por etapa, sem etapa por último, depois o mais novo. */
const ordenar = (lista: Projeto[]) => {
  const ordemDe = (p: Projeto) => (p.etapaId === null ? 999 : (ETAPAS.find((e) => e.id === p.etapaId)?.ordem ?? 99));
  return [...lista].sort((a, b) => ordemDe(a) - ordemDe(b) || b.uploadedAt.localeCompare(a.uploadedAt));
};

/** API em memória: o estado muda com as escritas e as leituras refletem. */
async function mockApi(page: Page, inicial: Projeto[], etapas = ETAPAS) {
  const projetos = structuredClone(inicial);
  const chamadas: Chamadas = { uploads: [], editar: [], excluir: [], leituras: 0, semMock: [] };
  let contador = 0;

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const metodo = req.method();
    const auth = req.headers().authorization ?? '';

    if (metodo === 'GET' && path === `/obras/${OBRA}/etapas`) return route.fulfill({ json: etapas });
    if (metodo === 'GET' && path === `/obras/${OBRA}/projetos`) {
      chamadas.leituras += 1;
      return route.fulfill({ json: ordenar(projetos) });
    }
    if (metodo === 'POST' && path === `/obras/${OBRA}/projetos`) {
      const corpo = req.postDataBuffer()?.toString('latin1') ?? '';
      const nome = /filename="([^"]*)"/.exec(corpo)?.[1] ?? '';
      chamadas.uploads.push({ auth, search: url.search, nome });
      contador += 1;
      const novo = projeto(
        `up${contador}`,
        nome,
        url.searchParams.get('etapaId'),
        url.searchParams.get('tipoDocumento'),
      );
      novo.uploadedAt = '2026-10-20T12:00:00Z';
      projetos.push(novo);
      return route.fulfill({ status: 201, json: novo });
    }
    const um = /^\/projetos\/([^/]+)$/.exec(path);
    if (metodo === 'PUT' && um) {
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.editar.push({ id: um[1] ?? '', auth, body });
      const p = projetos.find((x) => x.id === um[1]);
      if (!p) return route.fulfill({ status: 404, json: {} });
      Object.assign(p, { nome: body.nome, tipoDocumento: body.tipoDocumento, etapaId: body.etapaId });
      return route.fulfill({ json: p });
    }
    if (metodo === 'DELETE' && um) {
      chamadas.excluir.push({ id: um[1] ?? '', auth });
      const i = projetos.findIndex((x) => x.id === um[1]);
      if (i >= 0) projetos.splice(i, 1);
      return route.fulfill({ status: 204 });
    }
    chamadas.semMock.push(`${metodo} ${path}`);
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  });
  return chamadas;
}

const inicial = [
  projeto('p1', 'Planta de locação.pdf', 'e1', 'Planta baixa'),
  projeto('p2', 'Detalhe das sapatas.png', 'e1'),
  projeto('p3', 'Quantitativo.xlsx', 'e2', 'Planilha'),
  projeto('p4', 'Memorial descritivo.pdf', null, 'Memorial'),
];

test('admin lista, envia 2 arquivos, edita e exclui documentos', async ({ page }) => {
  const chamadas = await mockApi(page, inicial);
  await entrarComo(page, 'Admin');

  // Lista agrupada por etapa, "Sem etapa" por último.
  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Projetos', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Enviar documentos',
    'Fundação',
    'Alvenaria',
    'Sem etapa',
  ]);
  await expect(page.getByText(/A obra tem 4 de 200 documentos\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visualizar Quantitativo.xlsx' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Baixar Quantitativo.xlsx' })).toBeVisible();

  // Envio de 2 arquivos (recusa o .txt), com etapa e tipo do lote.
  await page.getByLabel(/Arraste os documentos aqui/).setInputFiles([
    { name: 'Detalhe viga.pdf', mimeType: 'application/pdf', buffer: PDF },
    { name: 'Corte A.png', mimeType: 'image/png', buffer: PNG },
    { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
  ]);
  await expect(page.getByText('notas.txt: Tipo de arquivo não permitido.', { exact: false })).toBeVisible();
  await page.getByLabel('Etapa do lote').selectOption({ label: 'Alvenaria' });
  await page.getByLabel('Tipo de documento do lote').fill('Estrutural & corte');
  await page.getByRole('button', { name: 'Enviar 2 documentos' }).click();
  await expect(page.getByText('2 de 2 documentos enviados')).toBeVisible();
  expect(chamadas.uploads.map((u) => u.nome)).toEqual(['Detalhe viga.pdf', 'Corte A.png']);
  expect(chamadas.uploads.every((u) => u.auth === 'Bearer token-sintetico')).toBe(true);
  expect(chamadas.uploads[0]?.search).toBe('?etapaId=e2&tipoDocumento=Estrutural%20%26%20corte');
  await expect(page.getByText(/A obra tem 6 de 200 documentos\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar Corte A.png' })).toBeVisible();

  // Editar: renomeia, muda a etapa e limpa o tipo; o PUT leva os 3 campos.
  await page.getByRole('button', { name: 'Editar Memorial descritivo.pdf' }).click();
  const editar = page.getByRole('dialog', { name: 'Editar documento' });
  await editar.getByLabel('Nome do documento').fill('Memorial final.pdf');
  await editar.getByLabel('Tipo de documento').fill('');
  await editar.getByLabel('Etapa').selectOption({ label: 'Fundação' });
  await editar.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Documento atualizado.')).toBeVisible();
  await expect(editar).toHaveCount(0);
  expect(chamadas.editar).toEqual([
    {
      id: 'p4',
      auth: 'Bearer token-sintetico',
      body: { nome: 'Memorial final.pdf', tipoDocumento: null, etapaId: 'e1' },
    },
  ]);
  await expect(page.getByRole('button', { name: 'Editar Memorial final.pdf' })).toBeVisible();
  // Não sobrou documento sem etapa: o grupo "Sem etapa" some.
  await expect(page.getByRole('heading', { name: 'Sem etapa', level: 2 })).toHaveCount(0);

  // Excluir: confirmação com o nome, depois a lista sem o documento.
  await page.getByRole('button', { name: 'Excluir Quantitativo.xlsx' }).click();
  await expect(page.getByText('Excluir definitivamente o documento Quantitativo.xlsx?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText('Documento excluído.')).toBeVisible();
  expect(chamadas.excluir).toEqual([{ id: 'p3', auth: 'Bearer token-sintetico' }]);
  await expect(page.getByRole('button', { name: 'Editar Quantitativo.xlsx' })).toHaveCount(0);
  await expect(page.getByText(/A obra tem 5 de 200 documentos\./)).toBeVisible();
  expect(chamadas.semMock).toEqual([]);
});

test('200 documentos com nomes de 255 caracteres carregam sem erro de console e sem estourar a largura', async ({
  page,
}) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  const mock = JSON.parse(
    readFileSync(new URL('./mocks/projetos-admin-estresse.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  const lista = mock[`GET /obras/${OBRA}/projetos`] as Projeto[];
  const etapas = mock[`GET /obras/${OBRA}/etapas`] as typeof ETAPAS;
  expect(lista).toHaveLength(200);
  expect(Math.max(...lista.map((p) => p.nome.length))).toBe(255);
  const chamadas = await mockApi(page, lista, etapas);
  await entrarComo(page, 'Admin');
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto(ROTA);
  await expect(page.getByRole('button', { name: /^Baixar / })).toHaveCount(200);
  await expect(page.getByText(/A obra tem 200 de 200 documentos\./)).toBeVisible();
  await expect(page.getByLabel(/Limite de 200 documentos atingido/)).toBeDisabled();
  const semEstouro = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(semEstouro).toBe(true);
  // O botão da última linha continua visível (não foi empurrado para fora do card pelo nome longo).
  const ultimo = page.getByRole('button', { name: /^Excluir / }).last();
  await ultimo.scrollIntoViewIfNeeded();
  const caixa = await ultimo.boundingBox();
  expect(caixa).not.toBeNull();
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(1280);
  expect(erros).toEqual([]);
  expect(chamadas.semMock).toEqual([]);
});

test('cliente é barrado em /admin/.../projetos e nenhuma chamada é feita', async ({ page }) => {
  const chamadas = await mockApi(page, inicial);
  await entrarComo(page, 'Client');

  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByLabel(/Arraste os documentos aqui/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /editar|excluir|enviar/i })).toHaveCount(0);
  expect(chamadas.leituras).toBe(0);
  expect(chamadas.uploads).toHaveLength(0);
  expect(chamadas.editar).toHaveLength(0);
  expect(chamadas.excluir).toHaveLength(0);
});

test('deslogado vai para o login', async ({ page }) => {
  const chamadas = await mockApi(page, inicial);
  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(chamadas.leituras).toBe(0);
});
