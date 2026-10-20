import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos, os mesmos do mock de captura visual.
const API = 'http://localhost:5285';
const OBRA = 'a1';
const MOCK = JSON.parse(readFileSync(new URL('./mocks/dashboard.json', import.meta.url), 'utf8')) as Record<
  string,
  Record<string, unknown>
>;
const DASHBOARD = MOCK[`GET /obras/${OBRA}/dashboard`]!;

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

/** Responde só o dashboard; qualquer outra chamada vira 501 e é registrada em `naoMockadas`. */
async function mockarApi(page: Page, corpo: unknown = DASHBOARD, status = 200) {
  const naoMockadas: string[] = [];
  const auth: string[] = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === 'GET' && path.endsWith('/dashboard')) {
      auth.push(req.headers().authorization ?? '');
      return route.fulfill({ status, json: corpo });
    }
    naoMockadas.push(`${req.method()} ${path}`);
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${path}` } });
  });
  return { naoMockadas, auth };
}

const mesesSinteticos = (quantidade: number) => {
  let acumulado = 0;
  return Array.from({ length: quantidade }, (_, i) => {
    const indice = 2024 * 12 + i;
    const competencia = `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}-01`;
    const valorMedido = 10000 + (i % 5) * 2500;
    acumulado += valorMedido;
    return { competencia, valorMedido, valorMedidoAcumulado: acumulado };
  });
};

for (const largura of [1440, 1280]) {
  test(`cliente vê KPIs, etapas e o gráfico desenhado, sem estourar a página (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoMockadas, auth } = await mockarApi(page);
    await entrarComoCliente(page);

    await page.goto(`/cliente/obras/${OBRA}`);
    await expect(page.getByRole('heading', { name: 'Residencial Aurora' })).toBeVisible();

    // KPIs
    const main = page.getByRole('main');
    await expect(main.getByText('Avanço físico', { exact: true })).toBeVisible();
    await expect(main.getByText('58,5%')).toBeVisible();
    await expect(main.getByText('72 dias')).toBeVisible();
    await expect(main.getByText('Previsão: 31/12/2026')).toBeVisible();
    await expect(main.getByText('R$ 366.386,55', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Pago: R$ 310.000,00')).toBeVisible();
    await expect(main.getByText('R$ 185.668,45', { exact: true })).toBeVisible();
    await expect(main.getByText('de R$ 552.055,00')).toBeVisible();
    await expect(main.getByText(/custo real|margem/i)).toHaveCount(0);

    // Gráfico: svg desenhado de verdade (no jsdom não há layout)
    const grafico = page.getByRole('img', { name: /Gráfico do custo acumulado/ });
    const svg = grafico.locator('svg.recharts-surface');
    await expect(svg).toBeVisible();
    const caixa = await svg.boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThan(300);
    expect(caixa?.height ?? 0).toBeGreaterThan(200);
    // 11 meses da API + janeiro/26 completado = 12 pontos na linha; todo mês tem rótulo no eixo X
    await expect(grafico.locator('.recharts-line-dot')).toHaveCount(12);
    await expect(grafico.locator('.recharts-xAxis-tick-labels text')).toHaveCount(12);
    await expect(grafico.locator('.recharts-xAxis-tick-labels text', { hasText: 'Jan/26' })).toBeVisible();
    // gráfico dentro do card, sem rolagem horizontal da página
    const larguras = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(larguras.pagina).toBeLessThanOrEqual(larguras.janela);

    // Etapas: mesma altura em todas as linhas; nome longo cortado de verdade (título completo no atributo)
    const linhas = page.getByRole('list', { name: 'Avanço por etapa' }).getByRole('listitem');
    await expect(linhas).toHaveCount(8);
    const alturas = await linhas.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(new Set(alturas).size).toBe(1);
    const longo = page.getByTitle(/Revestimento Interno \(Reboco\) com um nome bem comprido/);
    await expect(longo).toBeVisible();
    expect(await longo.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await expect(page.getByText('Concluída').first()).toBeVisible();
    await expect(page.getByText('Não iniciada')).toBeVisible();

    // Sidebar e somente leitura
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await expect(main.getByRole('button')).toHaveCount(0);

    expect(auth[0]).toBe('Bearer token-sintetico');
    expect(naoMockadas).toEqual([]);
  });
}

test('eixo Y do gráfico usa rótulos compactos redondos em reais (R$ 100 mil), sem casa decimal ",0"', async ({
  page,
}) => {
  await mockarApi(page);
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}`);
  const eixoY = page
    .getByRole('img', { name: /Gráfico do custo acumulado/ })
    .locator('.recharts-yAxis-tick-labels text');
  await expect(eixoY).toHaveCount(5);
  const rotulos = (await eixoY.allTextContents()).map((t) => t.replace(/\s/g, ' '));
  // Máximo 366.386,55 → teto 400 mil, 4 intervalos de 100 mil (maximoDoEixo)
  expect(rotulos).toEqual(['R$ 0', 'R$ 100 mil', 'R$ 200 mil', 'R$ 300 mil', 'R$ 400 mil']);
});

test('muitos meses (30): o gráfico continua desenhado e dentro do card; tabela alternativa completa', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const meses = mesesSinteticos(30);
  const acumulado = meses[meses.length - 1]!.valorMedidoAcumulado;
  await mockarApi(page, {
    ...DASHBOARD,
    valores: { ...(DASHBOARD.valores as object), valorMedidoAcumulado: acumulado },
    medidoPorMes: meses,
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}`);
  const grafico = page.getByRole('img', { name: /Gráfico do custo acumulado/ });
  await expect(grafico.locator('svg.recharts-surface')).toBeVisible();
  await expect(grafico.locator('.recharts-line-dot')).toHaveCount(30);
  const rotulosX = await grafico.locator('.recharts-xAxis-tick-labels text').count();
  expect(rotulosX).toBeGreaterThan(1);
  expect(rotulosX).toBeLessThanOrEqual(30);
  const larguras = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(larguras.pagina).toBeLessThanOrEqual(larguras.janela);
  const linhasTabela = page
    .getByRole('table', { name: 'Custo acumulado por mês (medições aprovadas)' })
    .locator('tbody tr');
  await expect(linhasTabela).toHaveCount(30);
});

test('valor medido acima do contratado: "Acima do contratado" em vermelho, sem sinal de menos', async ({ page }) => {
  await mockarApi(page, {
    ...DASHBOARD,
    valores: { valorContratado: 100000, valorMedidoAcumulado: 101500.5, valorRestante: -1500.5, totalPago: 90000 },
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}`);
  const valor = page.getByText('R$ 1.500,50', { exact: true });
  await expect(valor).toBeVisible();
  await expect(page.getByText('Acima do contratado')).toBeVisible();
  await expect(page.getByText('de R$ 100.000,00')).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('-R$');
  await expect(page.getByRole('main')).not.toContainText('-1.500');
  // vermelho de verdade (token --danger), diferente do cinza do rótulo
  const cor = await valor.evaluate((el) => getComputedStyle(el).color);
  const corRotulo = await page.getByText('Acima do contratado').evaluate((el) => getComputedStyle(el).color);
  expect(cor).not.toBe(corRotulo);
});

test('prazo vencido e obra sem etapas nem medições (vazio, sem erro)', async ({ page }) => {
  await mockarApi(page, {
    ...DASHBOARD,
    avancoFisicoPercentual: 0,
    prazo: { diasRestantes: -12, dataPrevisaoTermino: '2026-10-08' },
    valores: { valorContratado: 0, valorMedidoAcumulado: 0, valorRestante: 0, totalPago: 0 },
    avancoPorEtapa: [],
    medidoPorMes: [],
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}`);
  await expect(page.getByText('Prazo vencido há 12 dias')).toBeVisible();
  await expect(page.getByText('Nenhuma etapa cadastrada ainda')).toBeVisible();
  await expect(page.getByText('Ainda não há medições aprovadas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Gráfico do custo acumulado/ })).toHaveCount(0);
});

test('cliente é barrado na rota admin e não chama o dashboard', async ({ page }) => {
  const { auth } = await mockarApi(page);
  await entrarComoCliente(page);

  await page.goto(`/admin/obras/${OBRA}`);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
  await expect(page.getByText(/em construção/)).toHaveCount(0);
  expect(auth).toEqual([]);
});

test('cliente sem vínculo com a obra recebe 403 e não vê dados', async ({ page }) => {
  await mockarApi(page, {}, 403);
  await entrarComoCliente(page);

  await page.goto('/cliente/obras/outra');
  await expect(page.getByRole('alert')).toContainText('não tem permissão');
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByText('Avanço físico')).toHaveCount(0);
});
