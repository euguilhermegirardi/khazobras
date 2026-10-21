import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos, os mesmos dos mocks de captura visual.
// Visão do ADMIN: liberar um lançamento, ação em lote, criar e editar com comprovante, excluir; larguras; acesso negado.
const API = 'http://localhost:5285';
const OBRA = 'a1';
const ROTA = `/admin/obras/${OBRA}/financeiro`;

interface Anexo {
  id: string;
  nomeArquivo: string;
  contentType: string;
  tamanhoBytes: number;
  uploadedAt: string;
}

interface Lancamento {
  id: string;
  obraId: string;
  categoria: 'MaoDeObra' | 'Material' | 'Equipamento';
  descricao: string;
  valor: number;
  dataLancamento: string;
  mesCompetencia: string;
  createdByUserId: string;
  visivelCliente: boolean;
  createdAt: string;
  anexos: Anexo[];
}

type Mock = Record<string, { items?: Lancamento[] }>;
const lerMock = (arquivo: string) =>
  JSON.parse(readFileSync(new URL(`./mocks/${arquivo}`, import.meta.url), 'utf8')) as Mock;
const LANCAMENTOS_NORMAIS = lerMock('financeiro-admin.json')[`GET /obras/${OBRA}/financeiro/lancamentos`]?.items ?? [];
const LANCAMENTOS_ESTRESSE =
  lerMock('financeiro-admin-estresse.json')[`GET /obras/${OBRA}/financeiro/lancamentos`]?.items ?? [];

const CATEGORIAS = [
  { valor: 'mao_de_obra', rotulo: 'Mão de obra' },
  { valor: 'material', rotulo: 'Material' },
  { valor: 'equipamento', rotulo: 'Equipamento' },
];
const PASCAL: Record<string, Lancamento['categoria']> = {
  mao_de_obra: 'MaoDeObra',
  material: 'Material',
  equipamento: 'Equipamento',
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
  listas: string[];
  resumos: number;
  patches: { id: string; auth: string; body: Record<string, unknown> }[];
  lotes: { auth: string; body: { ids: string[]; visivelCliente: boolean } }[];
  posts: { auth: string; body: Record<string, unknown> }[];
  puts: { id: string; body: Record<string, unknown> }[];
  deletes: string[];
  uploads: { id: string; auth: string; campo: string | null; nome: string | null; tipo: string | null }[];
  anexosRemovidos: string[];
  semMock: string[];
}

const centavos = (v: number) => Math.round(v * 100);

/** API em memória: lista paginada com filtros, resumo recalculado e todas as escritas do módulo. */
async function mockApi(page: Page, inicial: Lancamento[], opcoes: { listaStatus?: number } = {}) {
  const estado: Lancamento[] = inicial.map((l) => ({ ...l, anexos: [...l.anexos] }));
  const chamadas: Chamadas = {
    listas: [],
    resumos: 0,
    patches: [],
    lotes: [],
    posts: [],
    puts: [],
    deletes: [],
    uploads: [],
    anexosRemovidos: [],
    semMock: [],
  };
  let seq = 0;

  const resumo = () => {
    const soma = (itens: Lancamento[]) => itens.reduce((s, l) => s + centavos(l.valor), 0) / 100;
    const liberados = estado.filter((l) => l.visivelCliente);
    const ocultos = estado.filter((l) => !l.visivelCliente);
    return {
      totalLancado: soma(estado),
      totalLiberadoCliente: soma(liberados),
      totalNaoLiberado: soma(ocultos),
      quantidadeLancamentos: estado.length,
      quantidadeLiberada: liberados.length,
      quantidadeNaoLiberada: ocultos.length,
    };
  };

  const tratar = async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const metodo = req.method();
    const auth = req.headers().authorization ?? '';

    if (metodo === 'GET' && path === `/obras/${OBRA}/financeiro/lancamentos`) {
      chamadas.listas.push(url.search);
      if (opcoes.listaStatus) return route.fulfill({ status: opcoes.listaStatus, json: {} });
      const pageIndex = Number(url.searchParams.get('pageIndex') ?? 0);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
      const items = estado.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      return route.fulfill({ json: { totalItems: estado.length, pageIndex, pageSize, items } });
    }
    if (metodo === 'GET' && path === `/obras/${OBRA}/financeiro/resumo`) {
      chamadas.resumos += 1;
      return route.fulfill({ json: resumo() });
    }
    if (metodo === 'GET' && path === '/financeiro/categorias') return route.fulfill({ json: CATEGORIAS });

    if (metodo === 'POST' && path === '/financeiro/lancamentos') {
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.posts.push({ auth, body });
      seq += 1;
      const novo: Lancamento = {
        id: `novo-${seq}`,
        obraId: OBRA,
        categoria: PASCAL[String(body.categoria)] ?? 'Material',
        descricao: String(body.descricao),
        valor: Number(body.valor),
        dataLancamento: String(body.dataLancamento),
        mesCompetencia: String(body.mesCompetencia),
        createdByUserId: '00000000-0000-0000-0000-000000000001',
        visivelCliente: Boolean(body.visivelCliente),
        createdAt: '2026-10-20T12:00:00Z',
        anexos: [],
      };
      estado.unshift(novo);
      return route.fulfill({ status: 201, json: novo });
    }
    const unitario = /^\/financeiro\/lancamentos\/([^/]+)$/.exec(path);
    if (metodo === 'PUT' && unitario) {
      const id = unitario[1] ?? '';
      const body = req.postDataJSON() as Record<string, unknown>;
      chamadas.puts.push({ id, body });
      const atual = estado.find((l) => l.id === id);
      if (!atual) return route.fulfill({ status: 404, json: {} });
      Object.assign(atual, {
        categoria: PASCAL[String(body.categoria)] ?? atual.categoria,
        descricao: String(body.descricao),
        valor: Number(body.valor),
        dataLancamento: String(body.dataLancamento),
        mesCompetencia: String(body.mesCompetencia),
        visivelCliente: Boolean(body.visivelCliente),
      });
      return route.fulfill({ json: atual });
    }
    if (metodo === 'DELETE' && unitario) {
      const id = unitario[1] ?? '';
      chamadas.deletes.push(id);
      const indice = estado.findIndex((l) => l.id === id);
      if (indice < 0) return route.fulfill({ status: 404, json: {} });
      estado.splice(indice, 1);
      return route.fulfill({ status: 204 });
    }
    const visibilidade = /^\/financeiro\/lancamentos\/([^/]+)\/visibilidade$/.exec(path);
    if (metodo === 'PATCH' && visibilidade) {
      const id = visibilidade[1] ?? '';
      const body = req.postDataJSON() as { visivelCliente: boolean };
      chamadas.patches.push({ id, auth, body });
      const atual = estado.find((l) => l.id === id);
      if (!atual) return route.fulfill({ status: 404, json: {} });
      atual.visivelCliente = body.visivelCliente;
      return route.fulfill({ json: atual });
    }
    if (metodo === 'PATCH' && path === `/obras/${OBRA}/financeiro/lancamentos/visibilidade`) {
      const body = req.postDataJSON() as { ids: string[]; visivelCliente: boolean };
      chamadas.lotes.push({ auth, body });
      const unicos = [...new Set(body.ids)];
      if (unicos.length === 0 || unicos.length > 200 || unicos.some((id) => !estado.some((l) => l.id === id))) {
        return route.fulfill({
          status: 400,
          json: { errors: { Ids: ['Um ou mais lancamentos informados nao pertencem a esta obra.'] } },
        });
      }
      for (const l of estado) if (unicos.includes(l.id)) l.visivelCliente = body.visivelCliente;
      return route.fulfill({ json: { atualizados: unicos.length, visivelCliente: body.visivelCliente } });
    }
    const upload = /^\/financeiro\/lancamentos\/([^/]+)\/anexos$/.exec(path);
    if (metodo === 'POST' && upload) {
      const id = upload[1] ?? '';
      // multipart cru: o nome do campo, o nome do arquivo e o Content-Type ficam nos cabeçalhos da parte.
      const cru = req.postDataBuffer()?.toString('latin1') ?? '';
      const nomeCampo = /name="([^"]+)"/.exec(cru)?.[1] ?? null;
      const nomeArquivo = /filename="([^"]*)"/.exec(cru)?.[1] ?? null;
      const tipo = /Content-Type: ([^\r\n]+)/i.exec(cru.split('\r\n\r\n')[0] ?? '')?.[1] ?? null;
      chamadas.uploads.push({ id, auth, campo: nomeCampo, nome: nomeArquivo, tipo });
      const atual = estado.find((l) => l.id === id);
      if (!atual) return route.fulfill({ status: 404, json: {} });
      seq += 1;
      const novo: Anexo = {
        id: `anx-novo-${seq}`,
        nomeArquivo: nomeArquivo ?? 'arquivo',
        contentType: tipo ?? 'application/octet-stream',
        tamanhoBytes: 1024,
        uploadedAt: '2026-10-20T12:00:00Z',
      };
      atual.anexos = [...atual.anexos, novo];
      return route.fulfill({ status: 201, json: novo });
    }
    const anexoUnitario = /^\/financeiro\/anexos\/([^/]+)$/.exec(path);
    if (metodo === 'DELETE' && anexoUnitario) {
      const id = anexoUnitario[1] ?? '';
      chamadas.anexosRemovidos.push(id);
      const dono = estado.find((l) => l.anexos.some((a) => a.id === id));
      if (!dono) return route.fulfill({ status: 404, json: {} });
      dono.anexos = dono.anexos.filter((a) => a.id !== id);
      return route.fulfill({ status: 204 });
    }
    const baixar = /^\/financeiro\/anexos\/([^/]+)\/download$/.exec(path);
    if (metodo === 'GET' && baixar) {
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        // O backend expõe Content-Disposition no CORS (WithExposedHeaders em Program.cs); a simulação faz o mesmo.
        headers: {
          'Content-Disposition': 'attachment; filename="comprovante-servidor.pdf"',
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
        body: Buffer.from('%PDF-1.4 sintetico'),
      });
    }
    chamadas.semMock.push(`${metodo} ${path}`);
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  };

  await page.route(`${API}/**`, tratar);
  return { chamadas, estado };
}

const kpi = (page: Page, rotulo: string) => page.getByText(rotulo, { exact: true }).locator('xpath=..');
const interruptor = (page: Page, descricao: string) =>
  page.getByRole('switch', { name: `Visível ao cliente: ${descricao}` });

test('admin libera um lançamento pelo interruptor e o resumo acompanha', async ({ page }) => {
  const { chamadas } = await mockApi(page, LANCAMENTOS_NORMAIS);
  await entrarComo(page, 'Admin');

  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
  await expect(kpi(page, 'Liberado ao cliente')).toContainText('7 lançamentos');
  const alvo = 'Pedreiros e serventes - semana 41';
  await expect(interruptor(page, alvo)).toHaveAttribute('aria-checked', 'false');

  await interruptor(page, alvo).click();

  await expect(page.getByText('Lançamento liberado ao cliente.')).toBeVisible();
  await expect(interruptor(page, alvo)).toHaveAttribute('aria-checked', 'true');
  expect(chamadas.patches).toEqual([{ id: 'f11', auth: 'Bearer token-sintetico', body: { visivelCliente: true } }]);
  await expect(kpi(page, 'Liberado ao cliente')).toContainText('8 lançamentos');
  await expect(kpi(page, 'Não liberado')).toContainText('4 lançamentos');
  expect(chamadas.semMock).toEqual([]);
});

test('admin seleciona vários lançamentos e libera em lote', async ({ page }) => {
  const { chamadas } = await mockApi(page, LANCAMENTOS_NORMAIS);
  await entrarComo(page, 'Admin');
  await page.goto(ROTA);

  const ocultos = ['Eletricista - instalação de quadros', 'Andaime fachadeiro - 30 dias'];
  for (const descricao of ocultos) {
    await page.getByRole('checkbox', { name: `Selecionar lançamento: ${descricao}` }).check();
  }
  const barra = page.getByRole('region', { name: 'Ações em lote' });
  await expect(barra).toContainText('2 selecionados');
  await expect(page.getByRole('checkbox', { name: 'Selecionar todos os lançamentos desta página' })).toHaveJSProperty(
    'indeterminate',
    true,
  );

  await barra.getByRole('button', { name: 'Liberar ao cliente' }).click();

  await expect(page.getByText('2 lançamentos liberados ao cliente.')).toBeVisible();
  expect(chamadas.lotes).toHaveLength(1);
  expect(chamadas.lotes[0]?.auth).toBe('Bearer token-sintetico');
  expect([...(chamadas.lotes[0]?.body.ids ?? [])].sort()).toEqual(['f06', 'f08']);
  expect(chamadas.lotes[0]?.body.visivelCliente).toBe(true);
  await expect(barra).toHaveCount(0);
  for (const descricao of ocultos) await expect(interruptor(page, descricao)).toHaveAttribute('aria-checked', 'true');
  await expect(kpi(page, 'Não liberado')).toContainText('3 lançamentos');
});

test('admin cria um lançamento, edita, anexa e baixa um comprovante e remove', async ({ page }) => {
  const { chamadas } = await mockApi(page, LANCAMENTOS_NORMAIS.slice(0, 2));
  await entrarComo(page, 'Admin');
  await page.goto(ROTA);

  // Criar: nasce oculto.
  await page.getByRole('button', { name: '+ Novo lançamento' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo lançamento' });
  await expect(novo.getByLabel('Liberar ao cliente')).not.toBeChecked();
  await novo.getByLabel('Categoria').selectOption('equipamento');
  await novo.getByLabel('Descrição').fill('  Locação de compactador  ');
  await novo.getByLabel('Valor (R$)').fill('3250,75');
  await novo.getByLabel('Data do lançamento').fill('2026-10-18');
  await novo.getByLabel('Competência').fill('2026-10');
  await novo.getByRole('button', { name: 'Criar lançamento' }).click();

  await expect(novo).toHaveCount(0);
  await expect(page.getByText(/Lançamento de R\$\s*3\.250,75 criado\./)).toBeVisible();
  expect(chamadas.posts).toHaveLength(1);
  expect(chamadas.posts[0]?.auth).toBe('Bearer token-sintetico');
  expect(chamadas.posts[0]?.body).toEqual({
    obraId: OBRA,
    categoria: 'equipamento',
    descricao: 'Locação de compactador',
    valor: 3250.75,
    dataLancamento: '2026-10-18',
    mesCompetencia: '2026-10-01',
    visivelCliente: false,
  });
  const linha = page.getByRole('row', { name: /Locação de compactador/ });
  await expect(linha).toContainText('18/10/2026');
  await expect(linha).toContainText('Outubro de 2026');
  await expect(linha).toContainText('Equipamento');
  await expect(linha).toContainText('Oculto');
  await expect(linha).toContainText('Sem anexos');

  // Editar: valores atuais e PUT com a flag atual.
  await page.getByRole('button', { name: 'Editar lançamento: Locação de compactador' }).click();
  const edicao = page.getByRole('dialog', { name: 'Editar lançamento' });
  await expect(edicao.getByLabel('Categoria')).toHaveValue('equipamento');
  await expect(edicao.getByLabel('Valor (R$)')).toHaveValue('3250,75');
  await expect(edicao.getByLabel('Competência')).toHaveValue('2026-10');
  await edicao.getByLabel('Valor (R$)').fill('3300');
  await edicao.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(edicao).toHaveCount(0);
  expect(chamadas.puts).toHaveLength(1);
  expect(chamadas.puts[0]?.body).toEqual({
    categoria: 'equipamento',
    descricao: 'Locação de compactador',
    valor: 3300,
    dataLancamento: '2026-10-18',
    mesCompetencia: '2026-10-01',
    visivelCliente: false,
  });
  await expect(page.getByRole('row', { name: /Locação de compactador/ })).toContainText(/R\$\s*3\.300,00/);

  // Anexar: multipart com o campo "file", MIME regravado pela extensão e o token.
  await page.getByRole('button', { name: 'Editar lançamento: Locação de compactador' }).click();
  const comAnexo = page.getByRole('dialog', { name: 'Editar lançamento' });
  await expect(comAnexo.getByText('Nenhum comprovante anexado.')).toBeVisible();
  await comAnexo.getByLabel('Enviar comprovante').setInputFiles({
    name: 'comprovante.PDF',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('%PDF-1.4 x'),
  });
  await expect(comAnexo.getByText('comprovante.PDF', { exact: false })).toBeVisible();
  await expect(comAnexo.getByText('1 de 10')).toBeVisible();
  expect(chamadas.uploads).toEqual([
    { id: 'novo-1', auth: 'Bearer token-sintetico', campo: 'file', nome: 'comprovante.PDF', tipo: 'application/pdf' },
  ]);

  // Recusa tipo não permitido sem chamar o servidor.
  await comAnexo
    .getByLabel('Enviar comprovante')
    .setInputFiles({ name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
  await expect(comAnexo.getByRole('alert')).toContainText('Tipo de arquivo não permitido');
  expect(chamadas.uploads).toHaveLength(1);

  // Baixar pela API autenticada: o nome vem do Content-Disposition.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    comAnexo.getByRole('button', { name: 'Baixar comprovante.PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('comprovante-servidor.pdf');
  expect(download.url()).toMatch(/^blob:/);

  // Remover com confirmação inline.
  await comAnexo.getByRole('button', { name: 'Remover comprovante.PDF' }).click();
  await expect(comAnexo.getByText('Remover este comprovante?')).toBeVisible();
  await comAnexo.getByRole('button', { name: 'Confirmar remoção de comprovante.PDF' }).click();
  await expect(comAnexo.getByText('Nenhum comprovante anexado.')).toBeVisible();
  expect(chamadas.anexosRemovidos).toEqual(['anx-novo-2']);
  await comAnexo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('row', { name: /Locação de compactador/ })).toContainText('Sem anexos');
  expect(chamadas.semMock).toEqual([]);
});

test('admin exclui um lançamento depois de confirmar', async ({ page }) => {
  const { chamadas } = await mockApi(page, LANCAMENTOS_NORMAIS);
  await entrarComo(page, 'Admin');
  await page.goto(ROTA);
  await expect(kpi(page, 'Total lançado')).toContainText('12 lançamentos');

  await page.getByRole('button', { name: 'Excluir lançamento: Frete de maquinário - retroescavadeira' }).click();
  await expect(page.getByText(/Excluir definitivamente.*\? Os comprovantes também serão removidos\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  expect(chamadas.deletes).toHaveLength(0);
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();

  await expect(page.getByText('Lançamento excluído.')).toBeVisible();
  expect(chamadas.deletes).toEqual(['f03']);
  await expect(page.getByRole('row', { name: /Frete de maquinário/ })).toHaveCount(0);
  await expect(kpi(page, 'Total lançado')).toContainText('11 lançamentos');
});

test('filtros e paginação pedem os parâmetros certos à API', async ({ page }) => {
  const { chamadas } = await mockApi(page, LANCAMENTOS_ESTRESSE);
  await entrarComo(page, 'Admin');
  await page.goto(ROTA);
  await expect(page.getByRole('table')).toBeVisible();
  expect(chamadas.listas.at(-1)).toBe('?pageIndex=0&pageSize=20');

  await page.getByLabel('Visibilidade').selectOption('false');
  await expect.poll(() => chamadas.listas.at(-1)).toBe('?pageIndex=0&pageSize=20&visivelCliente=false');
  await page.getByLabel('Categoria').selectOption('material');
  await expect
    .poll(() => chamadas.listas.at(-1))
    .toBe('?pageIndex=0&pageSize=20&visivelCliente=false&categoria=material');
  await page.getByLabel('Competência').fill('2026-10');
  await expect
    .poll(() => chamadas.listas.at(-1))
    .toBe('?pageIndex=0&pageSize=20&visivelCliente=false&categoria=material&competencia=2026-10');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect.poll(() => chamadas.listas.at(-1)).toBe('?pageIndex=0&pageSize=20');
});

for (const largura of [1280, 1440]) {
  for (const [nome, lancamentos] of [
    ['mock normal', LANCAMENTOS_NORMAIS],
    ['mock de estresse', LANCAMENTOS_ESTRESSE],
  ] as const) {
    test(`${nome}: sem rolagem horizontal e linhas da mesma altura em ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await mockApi(page, lancamentos);
      await entrarComo(page, 'Admin');
      await page.goto(ROTA);
      const linhas = page.locator('tbody tr');
      await expect(linhas).toHaveCount(lancamentos.length);

      const medidas = await page.evaluate(() => {
        const tabela = document.querySelector('table');
        const caixa = tabela?.parentElement;
        return {
          pagina: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          caixaDaTabela: caixa ? [caixa.scrollWidth, caixa.clientWidth] : null,
          tabela: tabela ? [tabela.scrollWidth, tabela.clientWidth] : null,
        };
      });
      expect(medidas.pagina[0]).toBeLessThanOrEqual(medidas.pagina[1] ?? 0);
      expect(medidas.caixaDaTabela?.[0]).toBeLessThanOrEqual(medidas.caixaDaTabela?.[1] ?? 0);
      expect(medidas.tabela?.[0]).toBeLessThanOrEqual(medidas.tabela?.[1] ?? 0);

      // Todas as linhas com exatamente a mesma altura em pixels (com e sem anexos, com e sem ação).
      const alturas = await linhas.evaluateAll((trs) => trs.map((tr) => tr.getBoundingClientRect().height));
      expect(alturas.length).toBe(lancamentos.length);
      // A última linha não tem borda inferior (`[&_tr:last-child]:border-0` do TableBody do shadcn): com
      // `border-collapse` ela mede 0,5px a menos (48,5 contra 49). Todas as demais têm exatamente a mesma altura.
      const comBorda = alturas.slice(0, -1);
      expect(Math.max(...comBorda) - Math.min(...comBorda)).toBe(0);
      expect(Math.abs((alturas.at(-1) ?? 0) - (comBorda[0] ?? 0))).toBeLessThanOrEqual(0.5);

      // O valor nunca é cortado (R$ 12.345.678,90 cabe na coluna) e nenhuma célula de controle estoura.
      const valores = await page
        .locator('tbody tr td:nth-child(6)')
        .evaluateAll((tds) =>
          tds.map((td) => ({ texto: td.textContent ?? '', cortado: td.scrollWidth > td.clientWidth })),
        );
      for (const v of valores) expect(v.cortado, `valor cortado: ${v.texto}`).toBe(false);
      const controles = await page
        .locator('tbody tr td:nth-child(7), tbody tr td:nth-child(8), tbody tr td:nth-child(9)')
        .evaluateAll((tds) => tds.map((td) => td.scrollWidth > td.clientWidth));
      expect(controles.every((estourou) => !estourou)).toBe(true);
    });
  }
}

test('mock de estresse: descrição longa trunca com title e a tabela segue com 20 linhas selecionáveis', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page, LANCAMENTOS_ESTRESSE);
  await entrarComo(page, 'Admin');
  await page.goto(ROTA);

  const checkboxes = page.getByRole('checkbox', { name: /^Selecionar lançamento:/ });
  await expect(checkboxes).toHaveCount(20);
  await page.getByRole('checkbox', { name: 'Selecionar todos os lançamentos desta página' }).check();
  await expect(page.getByRole('region', { name: 'Ações em lote' })).toContainText('20 selecionados');
  const celula = page.locator('tbody tr').first().locator('td:nth-child(5)');
  const completo = await celula.getAttribute('title');
  expect(completo?.length).toBeGreaterThan(150);
  expect(await celula.evaluate((td) => td.scrollWidth > td.clientWidth)).toBe(true);
});

test('cliente é barrado na tela do admin e nenhuma chamada de financeiro sai', async ({ page }) => {
  const { chamadas } = await mockApi(page, LANCAMENTOS_NORMAIS);
  await entrarComo(page, 'Client');

  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByRole('button', { name: /novo lançamento/i })).toHaveCount(0);
  await expect(page.getByText('Total lançado')).toHaveCount(0);
  expect(chamadas.listas).toHaveLength(0);
  expect(chamadas.resumos).toBe(0);
});

test('admin em obra não vinculada recebe 403 da API e vê "sem permissão", sem tabela', async ({ page }) => {
  await mockApi(page, LANCAMENTOS_NORMAIS, { listaStatus: 403 });
  await entrarComo(page, 'Admin');

  await page.goto(ROTA);
  await expect(page.getByRole('alert')).toContainText(/não tem permissão/i);
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('deslogado vai para o login', async ({ page }) => {
  await mockApi(page, LANCAMENTOS_NORMAIS);
  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('sidebar do admin: Medições, Financeiro, Contratos, e o clique abre a tela da obra', async ({ page }) => {
  await mockApi(page, LANCAMENTOS_NORMAIS);
  await entrarComo(page, 'Admin');
  await page.goto(`/admin/obras/${OBRA}/medicoes/x`);

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const nomes = (await nav.getByRole('link').allTextContents()).map((t) => t.trim());
  const i = nomes.indexOf('Financeiro');
  expect(nomes.slice(i - 1, i + 2)).toEqual(['Medições', 'Financeiro', 'Contratos']);
  await nav.getByRole('link', { name: 'Financeiro' }).click();
  await expect(page).toHaveURL(`${ROTA}`);
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
});
