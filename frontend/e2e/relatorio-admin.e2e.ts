import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos. Visão do ADMIN: Relatório ao cliente (lista,
// novo, rascunho, publicado, histórico). O dev roda em StrictMode: GETs podem repetir, então só se contam escritas.
const API = 'http://localhost:5285';
const OBRA = 'a1';
const ROTA = `/admin/obras/${OBRA}/relatorio-ao-cliente`;

interface Relatorio {
  id: string;
  obraId: string;
  competencia: string;
  conteudo: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface Historico {
  acao: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
  campos: string[];
}

const relatorio = (id: string, competencia: string, over: Partial<Relatorio> = {}): Relatorio => ({
  id,
  obraId: OBRA,
  competencia,
  conteudo: `Texto do relatório ${id}.`,
  status: 'draft',
  publishedAt: null,
  createdByUserId: '00000000-0000-0000-0000-000000000001',
  createdAt: '2026-10-18T12:00:00Z',
  updatedAt: '2026-10-20T14:30:00Z',
  ...over,
});

const publicado = (id: string, competencia: string, over: Partial<Relatorio> = {}): Relatorio =>
  relatorio(id, competencia, { status: 'published', publishedAt: '2026-10-02T12:00:00Z', ...over });

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
  leituras: number;
  criar: { auth: string; body: Record<string, unknown> }[];
  editar: { id: string; auth: string; body: Record<string, unknown> }[];
  excluir: { id: string; auth: string }[];
  publicar: { id: string; auth: string }[];
  semMock: string[];
  /** Toda requisição na ordem em que chegou (`GET /relatorios-mensais/r1`...), para conferir o que veio depois de quê. */
  ordem: string[];
}

/** API em memória: o estado muda com as escritas, as leituras refletem e o histórico é gerado como o do backend. */
async function mockApi(page: Page, inicial: Relatorio[], historicosIniciais: Record<string, Historico[]> = {}) {
  const relatorios = structuredClone(inicial);
  const historicos = structuredClone(historicosIniciais);
  const chamadas: Chamadas = { leituras: 0, criar: [], editar: [], excluir: [], publicar: [], semMock: [], ordem: [] };
  let contador = 0;
  const registrar = (id: string, acao: string, campos: string[] = []) => {
    historicos[id] = [
      { acao, userId: 'u1', userName: 'Ana Admin', createdAt: new Date().toISOString(), campos },
      ...(historicos[id] ?? []),
    ];
  };

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const metodo = req.method();
    const auth = req.headers().authorization ?? '';
    chamadas.ordem.push(`${metodo} ${path}`);
    const um = /^\/relatorios-mensais\/([^/]+)(\/historico|\/publish)?$/.exec(path);
    const atual = relatorios.find((r) => r.id === um?.[1]);

    if (metodo === 'GET' && path === `/obras/${OBRA}/relatorios-mensais`) {
      chamadas.leituras += 1;
      const so = url.searchParams.get('onlyPublished') === 'true';
      return route.fulfill({ json: relatorios.filter((r) => !so || r.status === 'published') });
    }
    if (metodo === 'POST' && path === '/relatorios-mensais') {
      const body = req.postDataJSON() as { obraId: string; competencia: string; conteudo: string };
      chamadas.criar.push({ auth, body });
      if (relatorios.some((r) => r.competencia === body.competencia)) {
        return route.fulfill({
          status: 409,
          json: { message: 'Ja existe um relatorio desta obra para a competencia informada.' },
        });
      }
      contador += 1;
      const novo = relatorio(`novo${contador}`, body.competencia, {
        conteudo: body.conteudo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      relatorios.push(novo);
      registrar(novo.id, 'relatorio_mensal_criado');
      return route.fulfill({ status: 201, json: novo });
    }
    if (um && !um[2]) {
      if (!atual) return route.fulfill({ status: 404, json: {} });
      if (metodo === 'GET') return route.fulfill({ json: atual });
      if (metodo === 'PUT') {
        const body = req.postDataJSON() as { competencia: string; conteudo: string };
        chamadas.editar.push({ id: atual.id, auth, body });
        const campos = [
          ...(body.competencia !== atual.competencia ? ['competencia'] : []),
          ...(body.conteudo !== atual.conteudo ? ['conteudo'] : []),
        ];
        Object.assign(atual, { ...body, updatedAt: new Date().toISOString() });
        registrar(atual.id, 'relatorio_mensal_editado', campos);
        return route.fulfill({ json: atual });
      }
      if (metodo === 'DELETE') {
        chamadas.excluir.push({ id: atual.id, auth });
        relatorios.splice(relatorios.indexOf(atual), 1);
        return route.fulfill({ status: 204 });
      }
    }
    if (um?.[2] === '/publish' && metodo === 'POST') {
      if (!atual) return route.fulfill({ status: 404, json: {} });
      chamadas.publicar.push({ id: atual.id, auth });
      Object.assign(atual, { status: 'published', publishedAt: new Date().toISOString() });
      registrar(atual.id, 'relatorio_mensal_publicado');
      return route.fulfill({ json: atual });
    }
    if (um?.[2] === '/historico' && metodo === 'GET') {
      return route.fulfill({ json: historicos[um[1] ?? ''] ?? [] });
    }
    chamadas.semMock.push(`${metodo} ${path}`);
    return route.fulfill({ status: 501, json: { message: `sem mock: ${metodo} ${path}` } });
  });
  return chamadas;
}

/** Erros de console e de página (inclui falhas de recurso), para a checagem "sem erro de console". */
function coletarErros(page: Page) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  return erros;
}

const semEstouroHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('admin cria, edita, publica, vê o histórico e exclui outro rascunho', async ({ page }) => {
  const chamadas = await mockApi(page, [
    publicado('r2', '2026-09-01', { conteudo: 'Fundação concluída.' }),
    relatorio('r5', '2026-06-01', { conteudo: 'Rascunho antigo para excluir.' }),
  ]);
  await entrarComo(page, 'Admin');

  // Lista: H1, colunas, novo.
  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Relatório ao cliente', level: 1 })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveText([
    'Competência',
    'Resumo',
    'Status',
    'Publicado em',
    'Atualizado em',
    'Ações',
  ]);
  await expect(page.getByRole('link', { name: /^Abrir relatório de / })).toHaveText([
    'Setembro de 2026',
    'Junho de 2026',
  ]);

  // Criar.
  await page.getByRole('link', { name: '+ Novo relatório' }).click();
  await expect(page.getByRole('heading', { name: 'Novo relatório ao cliente', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByText('Escreva o conteúdo do relatório.')).toBeVisible();
  expect(chamadas.criar).toHaveLength(0);
  await page.getByLabel('Competência (mês)').fill('2026-10');
  const texto = '  Trabalhos do mês\n• Pisos concluídos\n• <b>Telhado</b> em andamento\n';
  await page.getByLabel('Conteúdo', { exact: true }).fill(texto);
  await expect(page.getByRole('region', { name: 'Como o cliente vê' }).getByText('Outubro de 2026')).toBeVisible();
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByText('Rascunho criado. O cliente só vê depois de publicar.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Relatório de Outubro de 2026', level: 1 })).toBeVisible();
  expect(chamadas.criar).toEqual([
    { auth: 'Bearer token-sintetico', body: { obraId: OBRA, competencia: '2026-10-01', conteudo: texto } },
  ]);

  // Formatação (Markdown simples): negrito pela barra; a prévia mostra o negrito e o campo guarda o texto cru.
  await page.getByLabel('Conteúdo', { exact: true }).fill('Pisos concluídos');
  await page.getByLabel('Conteúdo', { exact: true }).press('Control+A');
  await page.getByRole('button', { name: 'Negrito' }).click();
  await expect(page.getByLabel('Conteúdo', { exact: true })).toHaveValue('**Pisos concluídos**');
  await expect(page.getByRole('region', { name: 'Como o cliente vê' }).locator('strong')).toHaveText(
    'Pisos concluídos',
  );

  // Editar: PUT leva só os 2 campos.
  const novoTexto = `${texto}• Gesso: início dos forros\n`;
  await page.getByLabel('Conteúdo', { exact: true }).fill(novoTexto);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Rascunho atualizado.')).toBeVisible();
  expect(chamadas.editar).toEqual([
    { id: 'novo1', auth: 'Bearer token-sintetico', body: { competencia: '2026-10-01', conteudo: novoTexto } },
  ]);

  // Publicar: confirmação com foco em Cancelar; só vira publicado depois do "Publicar agora".
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(
    page.getByText('Publicar para o cliente? Depois de publicado não pode ser editado nem excluído.'),
  ).toBeVisible();
  await expect(page.getByRole('alert').getByRole('button', { name: 'Cancelar' })).toBeFocused();
  expect(chamadas.publicar).toHaveLength(0);
  await page.getByRole('button', { name: 'Publicar agora' }).click();
  await expect(page.getByText('Relatório publicado. O cliente já pode vê-lo.')).toBeVisible();
  expect(chamadas.publicar).toEqual([{ id: 'novo1', auth: 'Bearer token-sintetico' }]);
  await expect(page.getByText(/Relatório publicado: somente leitura/)).toBeVisible();
  await expect(page.getByLabel('Conteúdo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Publicar|Excluir rascunho|Salvar alterações)/ })).toHaveCount(0);
  // O HTML digitado aparece como texto, nunca como elemento.
  await expect(page.getByRole('region', { name: 'Como o cliente vê' }).getByText(/<b>Telhado<\/b>/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Como o cliente vê' }).locator('b')).toHaveCount(0);

  // Histórico: criado, editado (conteúdo), publicado; mais novo primeiro; sem códigos técnicos.
  const itens = page.getByRole('list', { name: 'Alterações do relatório' }).getByRole('listitem');
  await expect(itens).toHaveCount(3);
  await expect(itens.nth(0)).toContainText('Relatório publicado');
  await expect(itens.nth(1)).toContainText('Relatório editado');
  await expect(itens.nth(1)).toContainText('alterou: Conteúdo');
  await expect(itens.nth(2)).toContainText('Relatório criado');
  await expect(itens.nth(0)).toContainText('por Ana Admin');
  await expect(page.getByRole('list', { name: 'Alterações do relatório' })).not.toContainText('relatorio_mensal_');

  // Excluir OUTRO rascunho pela lista: Publicado não tem "Excluir".
  await page
    .getByRole('link', { name: /Relatórios/ })
    .last()
    .click();
  await expect(page.getByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excluir relatório de Outubro de 2026' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Excluir relatório de Setembro de 2026' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Excluir relatório de Junho de 2026' }).click();
  await expect(page.getByText('Excluir definitivamente este rascunho?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText('Rascunho excluído.')).toBeVisible();
  expect(chamadas.excluir).toEqual([{ id: 'r5', auth: 'Bearer token-sintetico' }]);
  await expect(page.getByRole('link', { name: 'Abrir relatório de Junho de 2026' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Abrir relatório de / })).toHaveText([
    'Outubro de 2026',
    'Setembro de 2026',
  ]);
  expect(chamadas.semMock).toEqual([]);
});

test('editor Markdown no navegador: foco e seleção após a barra, atalhos, abas, emoji e envio cru', async ({
  page,
}) => {
  const erros = coletarErros(page);
  const chamadas = await mockApi(page, []);
  await entrarComo(page, 'Admin');
  await page.goto(`${ROTA}/novo`);
  const campo = page.getByLabel('Conteúdo', { exact: true });
  const estado = () =>
    campo.evaluate((el: HTMLTextAreaElement) => ({
      valor: el.value,
      inicio: el.selectionStart,
      fim: el.selectionEnd,
      focado: document.activeElement === el,
    }));
  const selecionar = (inicio: number, fim: number) =>
    campo.evaluate(
      (el: HTMLTextAreaElement, [i, f]) => {
        el.focus();
        el.setSelectionRange(i ?? 0, f ?? 0);
      },
      [inicio, fim],
    );

  // Clique na barra: o foco e a seleção ficam no campo, sobre o trecho formatado.
  await campo.fill('Obra concluída hoje');
  await selecionar(5, 14);
  await page.getByRole('button', { name: 'Negrito' }).click();
  expect(await estado()).toEqual({ valor: 'Obra **concluída** hoje', inicio: 7, fim: 16, focado: true });

  // Ctrl+B desfaz (alterna) e Ctrl+I formata, sem digitar a letra.
  await page.keyboard.press('Control+b');
  expect(await estado()).toEqual({ valor: 'Obra concluída hoje', inicio: 5, fim: 14, focado: true });
  await page.keyboard.press('Control+i');
  expect((await estado()).valor).toBe('Obra *concluída* hoje');
  await page.keyboard.press('Control+i');

  // Meio de palavra e emoji (índices UTF-16 no navegador real).
  await selecionar(8, 11);
  await page.getByRole('button', { name: 'Itálico' }).click();
  expect((await estado()).valor).toBe('Obra con*clu*ída hoje');
  await campo.fill('😀 ok');
  await selecionar(0, 2);
  await page.getByRole('button', { name: 'Negrito' }).click();
  expect((await estado()).valor).toBe('**😀** ok');

  // Troca de aba: o texto e a seleção continuam, a prévia mostra o negrito e o vazio mostra o aviso.
  await selecionar(2, 4);
  await page.getByRole('tab', { name: 'Pré-visualizar' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Pré-visualizar' }).locator('strong')).toHaveText('😀');
  await page.getByRole('tab', { name: 'Escrever' }).click();
  expect(await estado()).toMatchObject({ valor: '**😀** ok', inicio: 2, fim: 4 });
  await campo.fill('');
  await page.getByRole('tab', { name: 'Pré-visualizar' }).click();
  await expect(page.getByText(/Nada para mostrar ainda/)).toBeVisible();
  await page.getByRole('tab', { name: 'Escrever' }).click();

  // Várias linhas: lista numerada e título; o texto enviado é exatamente o do campo (quebras do navegador = "\n").
  await campo.fill('Resumo\n\nPisos\nTelhado');
  await campo.press('Control+A');
  await page.getByRole('button', { name: 'Lista numerada' }).click();
  expect((await estado()).valor).toBe('1. Resumo\n\n2. Pisos\n3. Telhado');
  await page.getByRole('button', { name: 'Lista numerada' }).click();
  await selecionar(0, 0);
  await page.getByRole('button', { name: 'Título' }).click();
  expect((await estado()).valor).toBe('## Resumo\n\nPisos\nTelhado');

  await page.getByLabel('Competência (mês)').fill('2026-11');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByText('Rascunho criado. O cliente só vê depois de publicar.')).toBeVisible();
  expect(chamadas.criar.map((c) => c.body.conteudo)).toEqual(['## Resumo\n\nPisos\nTelhado']);
  expect(erros).toEqual([]);
  expect(chamadas.semMock).toEqual([]);
});

test('texto colado com caractere de direção do texto é recusado no navegador e nada é enviado', async ({ page }) => {
  const chamadas = await mockApi(page, []);
  await entrarComo(page, 'Admin');
  await page.goto(`${ROTA}/novo`);

  await page.getByLabel('Competência (mês)').fill('2026-11');
  await page.getByLabel('Conteúdo', { exact: true }).fill('relatório ‮fdp.exe ok');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();

  await expect(page.getByText('O conteúdo não pode ter caracteres de controle nem de direção do texto.')).toBeVisible();
  expect(chamadas.criar).toEqual([]);
});

test('excluir o rascunho pela própria página volta à lista sem piscar "não encontrado"', async ({ page }) => {
  const chamadas = await mockApi(page, [relatorio('r1', '2026-10-01'), publicado('r2', '2026-09-01')]);
  await entrarComo(page, 'Admin');
  // Registra, no navegador, qualquer momento em que a tela mostrou o erro do detalhe apagado.
  await page.addInitScript(() => {
    const w = window as unknown as { __intrusos: string[] };
    w.__intrusos = [];
    new MutationObserver(() => {
      const texto = document.body?.textContent ?? '';
      if (/Não encontrado\.|Não foi possível carregar o relatório/.test(texto)) w.__intrusos.push(texto.slice(-120));
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  await page.goto(`${ROTA}/r1`);
  await expect(page.getByLabel('Conteúdo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir rascunho' }).click();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();

  await expect(page.getByRole('table')).toBeVisible();
  await page.waitForTimeout(300);
  expect(chamadas.excluir).toEqual([{ id: 'r1', auth: 'Bearer token-sintetico' }]);
  await expect(page.getByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).toHaveCount(0);
  // Depois do DELETE ninguém relê o detalhe nem o histórico do rascunho apagado (seria um 404 certo).
  const depois = chamadas.ordem.slice(chamadas.ordem.indexOf('DELETE /relatorios-mensais/r1') + 1);
  expect(depois.filter((c) => c.includes('/relatorios-mensais/r1'))).toEqual([]);
  // E a tela nunca mostrou o erro do detalhe apagado (depende da velocidade da resposta; vale como segunda rede).
  const intrusos = await page.evaluate(() => (window as unknown as { __intrusos: string[] }).__intrusos);
  expect(intrusos).toEqual([]);
});

test('mês repetido (409) aparece no campo da competência e o texto digitado fica', async ({ page }) => {
  const chamadas = await mockApi(page, [publicado('r2', '2026-09-01')]);
  await entrarComo(page, 'Admin');

  await page.goto(`${ROTA}/novo`);
  await page.getByLabel('Competência (mês)').fill('2026-09');
  await page.getByLabel('Conteúdo', { exact: true }).fill('Meu texto');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();

  await expect(page.getByText(/Já existe um relatório desta obra para este mês/)).toBeVisible();
  await expect(page.getByLabel('Conteúdo', { exact: true })).toHaveValue('Meu texto');
  expect(chamadas.criar).toHaveLength(1);
});

test('relatório de outra obra na URL mostra "não encontrado nesta obra" e não vaza o texto', async ({ page }) => {
  await mockApi(page, [relatorio('rx', '2026-10-01', { obraId: 'b2', conteudo: 'Segredo de outra obra' })]);
  await entrarComo(page, 'Admin');

  await page.goto(`${ROTA}/rx`);
  await expect(page.getByText('Relatório não encontrado nesta obra.')).toBeVisible();
  await expect(page.getByText('Segredo de outra obra')).toHaveCount(0);
  await expect(page.getByLabel('Conteúdo', { exact: true })).toHaveCount(0);
});

test('60 relatórios, texto de 20000 caracteres e histórico de 100 carregam sem erro de console e sem estourar a largura', async ({
  page,
}) => {
  const erros = coletarErros(page);
  const lista = JSON.parse(
    readFileSync(new URL('./mocks/relatorio-admin-estresse.json', import.meta.url), 'utf8'),
  ) as Record<string, Relatorio[]>;
  const detalhe = JSON.parse(
    readFileSync(new URL('./mocks/relatorio-admin-detalhe-estresse.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  const relatorios = lista[`GET /obras/${OBRA}/relatorios-mensais`] ?? [];
  const rx = detalhe['GET /relatorios-mensais/rx'] as Relatorio;
  const historico = detalhe['GET /relatorios-mensais/rx/historico'] as Historico[];
  expect(relatorios).toHaveLength(60);
  expect(rx.conteudo).toHaveLength(20000);
  expect(historico).toHaveLength(100);
  const chamadas = await mockApi(page, [...relatorios, rx], { rx: historico });
  await entrarComo(page, 'Admin');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Lista de 60 (+ o rx): a linha de ações cabe e nada empurra a largura da página.
  await page.goto(ROTA);
  await expect(page.getByRole('link', { name: /^Abrir relatório de / })).toHaveCount(61);
  expect(await semEstouroHorizontal(page)).toBe(true);
  const ultimaAcao = page.getByRole('link', { name: /^(Editar|Ver) relatório de / }).last();
  await ultimaAcao.scrollIntoViewIfNeeded();
  const caixa = await ultimaAcao.boundingBox();
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(1280);
  // Células da tabela não vazam para a vizinha.
  const celulasQueVazam = await page.evaluate(
    () =>
      [...document.querySelectorAll('td')].filter(
        (td) => td.scrollWidth > td.clientWidth + 1 && getComputedStyle(td).textOverflow !== 'ellipsis',
      ).length,
  );
  expect(celulasQueVazam).toBe(0);

  // Rascunho com 20000 caracteres (uma "palavra" de 3068 sem espaço) e histórico de 100.
  await page.goto(`${ROTA}/rx`);
  await expect(page.getByLabel('Conteúdo', { exact: true })).toBeVisible();
  expect(await page.getByLabel('Conteúdo', { exact: true }).inputValue()).toHaveLength(20000);
  await expect(page.getByText('20000/20000')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Alterações do relatório' }).getByRole('listitem')).toHaveCount(100);
  expect(await semEstouroHorizontal(page)).toBe(true);
  const previa = page.getByRole('region', { name: 'Como o cliente vê' });
  const larguras = await previa.evaluate((el) => {
    const p = el.querySelector('p.whitespace-pre-line') ?? el.querySelector('p:last-of-type');
    const estilo = p ? getComputedStyle(p) : null;
    return {
      regiao: el.scrollWidth <= el.clientWidth,
      paragrafo: p ? p.scrollWidth <= p.clientWidth : false,
      whiteSpace: estilo?.whiteSpace,
      overflowWrap: estilo?.overflowWrap,
    };
  });
  // O parágrafo do Markdown usa `pre-line` (a quebra simples do texto antigo continua visível, espaços colapsam).
  expect(larguras).toEqual({ regiao: true, paragrafo: true, whiteSpace: 'pre-line', overflowWrap: 'anywhere' });
  const lista100 = page.getByRole('list', { name: 'Alterações do relatório' });
  expect(await lista100.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  expect(erros).toEqual([]);
  expect(chamadas.semMock).toEqual([]);
});

test('relatório publicado de 20000 caracteres também cabe na largura (somente leitura)', async ({ page }) => {
  const erros = coletarErros(page);
  const detalhe = JSON.parse(
    readFileSync(new URL('./mocks/relatorio-admin-detalhe-estresse.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  const rx = detalhe['GET /relatorios-mensais/rx'] as Relatorio;
  const historico = detalhe['GET /relatorios-mensais/rx/historico'] as Historico[];
  await mockApi(page, [{ ...rx, status: 'published', publishedAt: '2026-10-02T12:00:00Z' }], { rx: historico });
  await entrarComo(page, 'Admin');
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto(`${ROTA}/rx`);
  await expect(page.getByText(/Relatório publicado: somente leitura/)).toBeVisible();
  await expect(page.getByLabel('Conteúdo', { exact: true })).toHaveCount(0);
  expect(await semEstouroHorizontal(page)).toBe(true);
  const cabe = await page
    .getByRole('region', { name: 'Como o cliente vê' })
    .evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(cabe).toBe(true);
  expect(erros).toEqual([]);
});

// Texto montado com a barra (as cinco ferramentas). Blocos separados por linha em branco: sem continuação preguiçosa.
const MARKDOWN_BARRA = '## Resumo\n\n- Pisos\n- Telhado\n\n1. Gesso\n\n*Fundação* **concluída** hoje';
// Estrutura que o cliente (e a prévia do admin) tem de mostrar para o texto acima: tag + texto, na ordem do documento.
const ESTRUTURA_BARRA = [
  'H2:Resumo',
  'UL:Pisos Telhado',
  'LI:Pisos',
  'LI:Telhado',
  'OL:Gesso',
  'LI:Gesso',
  'P:Fundação concluída hoje',
  'EM:Fundação',
  'STRONG:concluída',
];
const estruturaDoTexto = (raiz: Element) =>
  [...raiz.querySelectorAll('h2,h3,ul,ol,li,p,strong,em,a,img')].map(
    (n) => `${n.tagName}:${(n.textContent ?? '').replace(/\s+/g, ' ').trim()}`,
  );

test('barra de formatação: prévia igual ao que o cliente verá e o rascunho/publicação enviam o Markdown cru', async ({
  page,
}) => {
  const erros = coletarErros(page);
  const chamadas = await mockApi(page, []);
  await entrarComo(page, 'Admin');
  await page.goto(`${ROTA}/novo`);
  const campo = page.getByLabel('Conteúdo', { exact: true });
  const selecionarTrecho = (trecho: string) =>
    campo.evaluate((el: HTMLTextAreaElement, t: string) => {
      const i = el.value.indexOf(t);
      el.focus();
      el.setSelectionRange(i, i + t.length);
    }, trecho);

  await campo.fill('Resumo\n\nPisos\nTelhado\n\nGesso\n\nFundação concluída hoje');
  await campo.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(0, 0);
  });
  await page.getByRole('button', { name: 'Título' }).click();
  await selecionarTrecho('Pisos\nTelhado');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await selecionarTrecho('Gesso');
  await page.getByRole('button', { name: 'Lista numerada' }).click();
  await selecionarTrecho('concluída');
  await page.getByRole('button', { name: 'Negrito' }).click();
  await selecionarTrecho('Fundação');
  await page.getByRole('button', { name: 'Itálico' }).click();
  await expect(campo).toHaveValue(MARKDOWN_BARRA);

  // Aba Pré-visualizar: mesma estrutura que o cliente verá e barra fora da tela (não há campo para formatar).
  await page.getByRole('tab', { name: 'Pré-visualizar' }).click();
  const painel = page.getByRole('tabpanel', { name: 'Pré-visualizar' });
  await expect(painel.locator('h2')).toHaveText('Resumo');
  expect(await painel.evaluate(estruturaDoTexto)).toEqual(ESTRUTURA_BARRA);
  // Na prévia a barra sai da tela (painel "Escrever" oculto); ao voltar, está ativa de novo.
  await expect(page.getByRole('toolbar', { name: 'Formatação do texto' })).toBeHidden();
  await page.getByRole('tab', { name: 'Escrever' }).click();
  await expect(page.getByRole('button', { name: 'Negrito' })).toBeEnabled();

  // Criar o rascunho: o corpo leva o Markdown exatamente como no campo.
  await page.getByLabel('Competência (mês)').fill('2026-12');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByText('Rascunho criado. O cliente só vê depois de publicar.')).toBeVisible();
  expect(chamadas.criar.map((c) => c.body.conteudo)).toEqual([MARKDOWN_BARRA]);

  // Publicar: o texto gravado não muda (o servidor guarda o cru) e o PUT/POST não reescrevem o conteúdo.
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar agora' }).click();
  await expect(page.getByText('Relatório publicado. O cliente já pode vê-lo.')).toBeVisible();
  expect(chamadas.publicar).toEqual([{ id: 'novo1', auth: 'Bearer token-sintetico' }]);
  expect(chamadas.editar).toEqual([]);
  // Publicado, somente leitura: a mesma estrutura, agora sem campo.
  const tituloLido = page.getByRole('region', { name: 'Como o cliente vê' }).getByRole('heading', { name: 'Resumo' });
  await expect(tituloLido).toBeVisible();
  expect(await tituloLido.locator('xpath=..').evaluate(estruturaDoTexto)).toEqual(ESTRUTURA_BARRA);
  expect(erros).toEqual([]);
  expect(chamadas.semMock).toEqual([]);
});

test('cliente vê a formatação renderizada e HTML, links e imagens colados viram só texto', async ({ page }) => {
  const erros = coletarErros(page);
  const externas: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('evil.example')) externas.push(r.url());
  });
  const hostil =
    'Veja <b>html</b> <script>window.__xss=1</script> <img src="http://evil.example/p.png" onerror="window.__xss=1"> ' +
    '[clique](http://evil.example/x) ![foto](http://evil.example/i.png) <http://evil.example/auto> [js](javascript:alert(1))';
  await mockApi(page, [
    publicado('r1', '2026-10-01', { conteudo: MARKDOWN_BARRA }),
    publicado('r2', '2026-09-01', { conteudo: hostil }),
  ]);
  await entrarComo(page, 'Client');
  await page.goto(`/cliente/obras/${OBRA}/relatorio-mensal`);

  // Formatação: a mesma estrutura da prévia do admin e nenhum marcador Markdown sobrando na tela.
  const titulo = page.locator('h2', { hasText: 'Resumo' });
  await expect(titulo).toBeVisible();
  expect(await titulo.locator('xpath=..').evaluate(estruturaDoTexto)).toEqual(ESTRUTURA_BARRA);
  await expect(page.getByText('**concluída**')).toHaveCount(0);
  await expect(page.getByText('## Resumo')).toHaveCount(0);

  // Hostil: nada de elemento perigoso dentro do texto; o HTML aparece como texto; nada externo é pedido.
  const paragrafo = page.locator('p', { hasText: 'clique' });
  await expect(paragrafo).toBeVisible();
  await expect(paragrafo).toContainText('<b>html</b>');
  await expect(paragrafo.locator('a, img, script, b, iframe')).toHaveCount(0);
  await expect(page.locator('img[src*="evil.example"], a[href*="evil.example"], a[href^="javascript:"]')).toHaveCount(
    0,
  );
  await page.waitForTimeout(300);
  expect(externas).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.getByRole('button', { name: /criar|novo|editar|excluir|publicar/i })).toHaveCount(0);
  expect(erros).toEqual([]);
});

test('cliente é barrado em todas as rotas novas e nenhuma chamada é feita', async ({ page }) => {
  const chamadas = await mockApi(page, [relatorio('r1', '2026-10-01')]);
  await entrarComo(page, 'Client');

  for (const rota of [ROTA, `${ROTA}/novo`, `${ROTA}/r1`]) {
    await page.goto(rota);
    await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
    await expect(page.getByLabel('Conteúdo', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /criar|novo|editar|excluir|publicar|salvar/i })).toHaveCount(0);
  }
  expect(chamadas.leituras).toBe(0);
  expect(chamadas.criar).toHaveLength(0);
  expect(chamadas.editar).toHaveLength(0);
  expect(chamadas.excluir).toHaveLength(0);
  expect(chamadas.publicar).toHaveLength(0);
});

test('deslogado vai para o login', async ({ page }) => {
  const chamadas = await mockApi(page, [relatorio('r1', '2026-10-01')]);
  await page.goto(ROTA);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.goto(`${ROTA}/r1`);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  expect(chamadas.leituras).toBe(0);
});
