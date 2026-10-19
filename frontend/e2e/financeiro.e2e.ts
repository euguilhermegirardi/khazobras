import { expect, test, type Page } from '@playwright/test';

// API simulada com page.route (sem backend nem banco). Dados sintéticos.
const API = 'http://localhost:5285';
const OBRA = 'a1';

const PDF = Buffer.from('%PDF-1.4\n%sintetico\n', 'utf8');

const anexo = (id: string, nomeArquivo: string) => ({
  id,
  nomeArquivo,
  contentType: 'application/pdf',
  tamanhoBytes: 20,
  uploadedAt: '2026-05-11T12:00:00Z',
});

const lancamento = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  obraId: OBRA,
  categoria: 'MaoDeObra',
  descricao: `Lançamento ${id}`,
  valor: 2850,
  dataLancamento: '2026-05-10',
  mesCompetencia: '2026-05-01',
  anexos: [],
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

test('cliente vê os lançamentos liberados e baixa um comprovante pela API com Bearer', async ({ page }) => {
  const auth: string[] = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname === `/obras/${OBRA}/financeiro/lancamentos`) {
      return route.fulfill({
        json: {
          totalItems: 2,
          pageIndex: 0,
          pageSize: 20,
          items: [
            lancamento('l1', {
              descricao: 'Pedreiro — semana 2',
              categoria: 'MaoDeObra',
              anexos: [anexo('anx1', 'recibo.pdf')],
            }),
            lancamento('l2', { descricao: 'Cimento CP-II', categoria: 'Material', valor: 3112 }),
          ],
        },
      });
    }
    if (req.method() === 'GET' && url.pathname === '/financeiro/anexos/anx1/download') {
      auth.push(req.headers().authorization ?? '');
      return route.fulfill({
        body: PDF,
        contentType: 'application/pdf',
        // O backend expõe Content-Disposition no CORS (WithExposedHeaders em Program.cs); a simulação precisa fazer o mesmo.
        headers: {
          'Content-Disposition': 'attachment; filename="comprovante-servidor.pdf"',
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
      });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${req.method()} ${url.pathname}` } });
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/financeiro`);
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible();
  await expect(page.getByText('Pedreiro — semana 2')).toBeVisible();
  await expect(page.getByText('Mão de obra')).toBeVisible();
  await expect(page.getByText('Maio de 2026').first()).toBeVisible();
  await expect(page.getByText('10/05/2026').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Financeiro' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /novo|criar|importar|editar|excluir|enviar|upload/i })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar comprovante recibo.pdf' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('comprovante-servidor.pdf');
  expect(download.url()).toMatch(/^blob:/);
  expect(auth).toEqual(['Bearer token-sintetico']);
});

test('paginação do servidor: Próxima busca a página 2', async ({ page }) => {
  const pedidos: string[] = [];
  await page.route(`${API}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/obras/${OBRA}/financeiro/lancamentos`) {
      const idx = Number(url.searchParams.get('pageIndex'));
      pedidos.push(String(idx));
      return route.fulfill({
        json: {
          totalItems: 45,
          pageIndex: idx,
          pageSize: 20,
          items: [lancamento(`p${idx}`, { descricao: `Item da página ${idx + 1}` })],
        },
      });
    }
    return route.fulfill({ status: 501, json: { message: `sem mock: ${url.pathname}` } });
  });
  await entrarComoCliente(page);

  await page.goto(`/cliente/obras/${OBRA}/financeiro`);
  await expect(page.getByText('Item da página 1')).toBeVisible();
  await expect(page.getByText('Página 1 de 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();

  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Item da página 2')).toBeVisible();
  await expect(page.getByText('Página 2 de 3')).toBeVisible();
  // No dev o StrictMode pode repetir o GET da página 0; o que importa é que a página 1 foi pedida ao servidor.
  expect(pedidos).toContain('0');
  expect(pedidos.at(-1)).toBe('1');
  expect(pedidos.filter((p) => p === '1')).toHaveLength(1);
});

test('cliente sem vínculo com a obra recebe 403 e não vê lançamentos', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 403, body: '' }));
  await entrarComoCliente(page);

  await page.goto('/cliente/obras/outra/financeiro');
  await expect(page.getByRole('alert')).toContainText('não tem permissão');
  await expect(page.getByRole('table')).toHaveCount(0);
});
