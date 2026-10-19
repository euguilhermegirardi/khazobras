import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LancamentoAnexo, LancamentoCliente } from '@/interfaces/financeiro';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const OBRA_ID = '22222222-2222-2222-2222-222222222222';
const ROTA = `/cliente/obras/${OBRA_ID}/financeiro`;
const TOKEN = 'token-falso-de-teste';
const LISTA = `${API}/obras/${OBRA_ID}/financeiro/lancamentos`;

const anexo = (id: string, over: Partial<LancamentoAnexo> = {}): LancamentoAnexo => ({
  id,
  nomeArquivo: `comprovante-${id}.pdf`,
  contentType: 'application/pdf',
  tamanhoBytes: 1024,
  uploadedAt: '2026-05-11T12:00:00Z',
  ...over,
});

const lancamento = (id: string, over: Partial<LancamentoCliente> = {}): LancamentoCliente => ({
  id,
  obraId: OBRA_ID,
  categoria: 'Material',
  descricao: `Lançamento ${id}`,
  valor: 1234.56,
  dataLancamento: '2026-05-10',
  mesCompetencia: '2026-05-01',
  anexos: [],
  ...over,
});

const pagina = (
  items: LancamentoCliente[],
  over: { totalItems?: number; pageIndex?: number; pageSize?: number } = {},
) => ({
  totalItems: over.totalItems ?? items.length,
  pageIndex: over.pageIndex ?? 0,
  pageSize: over.pageSize ?? 20,
  items,
});

const getLista = (body: unknown, status = 200) => http.get(LISTA, () => HttpResponse.json(body as never, { status }));

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockReset();
  createObjectURL.mockImplementation(() => 'blob:http://localhost/comprovante-1');
  revokeObjectURL.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Financeiro (cliente)', () => {
  describe('estados', () => {
    it('mostra carregando e depois a tabela', async () => {
      server.use(getLista(pagina([lancamento('l1', { descricao: 'Cimento CP-II' })])));
      renderApp(ROTA, 'Client');

      expect(screen.getByRole('status')).toHaveTextContent('Carregando lançamentos');
      expect(await screen.findByText('Cimento CP-II')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Financeiro' })).toBeInTheDocument();
      for (const col of ['Data', 'Competência', 'Categoria', 'Descrição', 'Valor', 'Comprovante']) {
        expect(screen.getByRole('columnheader', { name: col })).toBeInTheDocument();
      }
    });

    it('lista vazia mostra "Nenhum lançamento liberado ainda" e nada de tabela', async () => {
      server.use(getLista(pagina([])));
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('Nenhum lançamento liberado ainda')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('erro 500 mostra o requestId e permite tentar de novo', async () => {
      let calls = 0;
      server.use(
        http.get(LISTA, () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json({ requestId: 'req-fin-500', message: 'Erro interno' }, { status: 500 })
            : HttpResponse.json(pagina([lancamento('l1', { descricao: 'Areia média' })]));
        }),
      );
      renderApp(ROTA, 'Client');

      expect(await screen.findByRole('alert')).toHaveTextContent('req-fin-500');
      await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(await screen.findByText('Areia média')).toBeInTheDocument();
    });

    it('erro 403 mostra "sem permissão" e nenhum lançamento', async () => {
      server.use(getLista({}, 403));
      renderApp(ROTA, 'Client');

      expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('formatação', () => {
    it('mostra data sem deslocamento de fuso, competência em título e valor em BRL', async () => {
      server.use(
        getLista(
          pagina([lancamento('l1', { dataLancamento: '2026-05-01', mesCompetencia: '2026-05-01', valor: 12345.6 })]),
        ),
      );
      renderApp(ROTA, 'Client');

      const linha = (await screen.findByText('Lançamento l1')).closest('tr') as HTMLElement;
      expect(within(linha).getByText('01/05/2026')).toBeInTheDocument();
      expect(within(linha).getByText('Maio de 2026')).toBeInTheDocument();
      expect(within(linha).getByText(/R\$\s*12\.345,60/)).toBeInTheDocument();
    });

    it('data no último dia do mês não vira o dia anterior nem o seguinte', async () => {
      server.use(getLista(pagina([lancamento('l1', { dataLancamento: '2026-01-31', mesCompetencia: '2026-01-01' })])));
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('31/01/2026')).toBeInTheDocument();
      expect(screen.getByText('Janeiro de 2026')).toBeInTheDocument();
    });

    it('categoria em PascalCase (formato do backend) e em snake_case vira rótulo simples', async () => {
      server.use(
        getLista(
          pagina([
            lancamento('l1', { categoria: 'MaoDeObra' }),
            lancamento('l2', { categoria: 'Equipamento' }),
            lancamento('l3', { categoria: 'Material' }),
            lancamento('l4', { categoria: 'mao_de_obra' }),
          ]),
        ),
      );
      renderApp(ROTA, 'Client');

      await screen.findByText('Lançamento l1');
      expect(screen.getAllByText('Mão de obra')).toHaveLength(2);
      expect(screen.getByText('Equipamento')).toBeInTheDocument();
      // "Material" aparece só como categoria (o cabeçalho é "Categoria")
      expect(screen.getByText('Material')).toBeInTheDocument();
      expect(screen.queryByText('MaoDeObra')).not.toBeInTheDocument();
      expect(screen.queryByText('mao_de_obra')).not.toBeInTheDocument();
    });

    it('mostra a descrição como texto, sem interpretar HTML', async () => {
      server.use(getLista(pagina([lancamento('l1', { descricao: '<b>negrito</b>' })])));
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('<b>negrito</b>')).toBeInTheDocument();
    });
  });

  describe('comprovantes', () => {
    it('sem anexo mostra "—" e nenhum botão de baixar; com 2 anexos mostra 2 botões nomeados', async () => {
      server.use(
        getLista(
          pagina([
            lancamento('sem', { descricao: 'Sem comprovante' }),
            lancamento('dois', {
              descricao: 'Com dois',
              anexos: [anexo('a1', { nomeArquivo: 'nota-fiscal.pdf' }), anexo('a2', { nomeArquivo: 'recibo.png' })],
            }),
          ]),
        ),
      );
      renderApp(ROTA, 'Client');

      const semLinha = (await screen.findByText('Sem comprovante')).closest('tr') as HTMLElement;
      expect(within(semLinha).getByText('—')).toBeInTheDocument();
      expect(within(semLinha).queryByRole('button')).not.toBeInTheDocument();

      const doisLinha = screen.getByText('Com dois').closest('tr') as HTMLElement;
      expect(within(doisLinha).getAllByRole('button')).toHaveLength(2);
      expect(within(doisLinha).getByRole('button', { name: 'Baixar comprovante nota-fiscal.pdf' })).toBeInTheDocument();
      expect(within(doisLinha).getByRole('button', { name: 'Baixar comprovante recibo.png' })).toBeInTheDocument();
    });

    it('baixa pela API com Bearer, usa o nome do Content-Disposition e desabilita o botão durante', async () => {
      const auth: string[] = [];
      let liberar: () => void = () => {};
      const trava = new Promise<void>((resolve) => {
        liberar = resolve;
      });
      const cliques: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        cliques.push(`${this.download}|${this.href}`);
      });
      server.use(
        getLista(pagina([lancamento('l1', { anexos: [anexo('anx-1', { nomeArquivo: 'original.pdf' })] })])),
        http.get(`${API}/financeiro/anexos/anx-1/download`, async ({ request }) => {
          auth.push(request.headers.get('authorization') ?? '');
          await trava;
          return new HttpResponse(Uint8Array.from([37, 80, 68, 70]), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="nota-servidor.pdf"',
            },
          });
        }),
      );
      renderApp(ROTA, 'Client');
      const user = userEvent.setup();

      const botao = await screen.findByRole('button', { name: 'Baixar comprovante original.pdf' });
      await user.click(botao);
      await waitFor(() => expect(botao).toBeDisabled());

      liberar();
      await waitFor(() => expect(cliques).toHaveLength(1));
      await waitFor(() => expect(botao).toBeEnabled());

      expect(auth).toEqual([`Bearer ${TOKEN}`]);
      const [nome, href] = (cliques[0] ?? '').split('|');
      expect(nome).toBe('nota-servidor.pdf');
      expect(href).toMatch(/^blob:/);
      expect(href).not.toContain(API);
      expect(href).not.toMatch(/r2|cloudflare|amazonaws/i);
    });

    it('sem Content-Disposition cai no nome do anexo', async () => {
      const cliques: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        cliques.push(this.download);
      });
      server.use(
        getLista(pagina([lancamento('l1', { anexos: [anexo('anx-1', { nomeArquivo: 'original.pdf' })] })])),
        http.get(`${API}/financeiro/anexos/anx-1/download`, () => new HttpResponse(Uint8Array.from([1, 2, 3]))),
      );
      renderApp(ROTA, 'Client');

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Baixar comprovante original.pdf' }));
      await waitFor(() => expect(cliques).toEqual(['original.pdf']));
    });

    it.each([
      [500, { requestId: 'req-dl', message: 'Erro' }, /Não foi possível baixar o comprovante/],
      [403, {}, /não tem permissão para baixar/],
      [409, { message: 'conflito' }, /Não foi possível baixar o comprovante/],
    ])('falha %i no download mostra alerta e mantém a tabela', async (status, body, mensagem) => {
      server.use(
        getLista(
          pagina([lancamento('l1', { descricao: 'Fica na tela', anexos: [anexo('anx-1', { nomeArquivo: 'x.pdf' })] })]),
        ),
        http.get(`${API}/financeiro/anexos/anx-1/download`, () => HttpResponse.json(body, { status })),
      );
      renderApp(ROTA, 'Client');

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Baixar comprovante x.pdf' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(mensagem);
      expect(screen.getByText('Fica na tela')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('paginação (servidor)', () => {
    it('45 itens = 3 páginas; Anterior desabilitado na primeira, Próxima refaz o GET com pageIndex=1', async () => {
      const pedidos: string[] = [];
      server.use(
        http.get(LISTA, ({ request }) => {
          const url = new URL(request.url);
          pedidos.push(`${url.searchParams.get('pageIndex')}/${url.searchParams.get('pageSize')}`);
          const idx = Number(url.searchParams.get('pageIndex'));
          return HttpResponse.json(
            pagina([lancamento(`p${idx}`, { descricao: `Item da página ${idx + 1}` })], {
              totalItems: 45,
              pageIndex: idx,
            }),
          );
        }),
      );
      renderApp(ROTA, 'Client');
      const user = userEvent.setup();

      expect(await screen.findByText('Item da página 1')).toBeInTheDocument();
      expect(screen.getByText('45 lançamentos')).toBeInTheDocument();
      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
      expect(pedidos).toEqual(['0/20']);

      await user.click(screen.getByRole('button', { name: 'Próxima' }));
      expect(await screen.findByText('Item da página 2')).toBeInTheDocument();
      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
      expect(pedidos).toContain('1/20');
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Próxima' }));
      expect(await screen.findByText('Item da página 3')).toBeInTheDocument();
      expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Anterior' }));
      expect(await screen.findByText('Item da página 2')).toBeInTheDocument();
    });

    it('uma página só: Anterior e Próxima desabilitados', async () => {
      server.use(getLista(pagina([lancamento('l1')])));
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('1 lançamento')).toBeInTheDocument();
      expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    });
  });

  describe('papéis e segurança', () => {
    it('cliente é somente leitura: sem criar/editar/excluir/importar nem campo interno', async () => {
      server.use(getLista(pagina([lancamento('l1', { anexos: [anexo('a1')] })])));
      const { container } = renderApp(ROTA, 'Client');
      await screen.findByText('Lançamento l1');

      expect(
        screen.queryByRole('button', {
          name: /novo|criar|adicionar|importar|editar|excluir|remover|enviar|upload|pagador/i,
        }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(container.querySelector('input[type="file"]')).toBeNull();
      const main = screen.getByRole('main');
      expect(main).not.toHaveTextContent(/custo|margem|createdByUserId|visivelCliente|visivel_cliente/i);
    });

    it('master não entra na rota do cliente', async () => {
      renderApp(ROTA, 'Master');
      expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    });

    it('admin não entra na rota do cliente e a API não é chamada', async () => {
      let chamou = false;
      server.use(
        http.get(LISTA, () => {
          chamou = true;
          return HttpResponse.json(pagina([]));
        }),
      );
      renderApp(ROTA, 'Admin');
      expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
      expect(chamou).toBe(false);
    });

    it('deslogado é enviado ao login', async () => {
      renderApp(ROTA);
      expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
    });
  });

  describe('moldura', () => {
    it('sidebar tem "Financeiro" logo depois de "Fechamento", ativo na rota, e "← Minhas obras" na tela', async () => {
      server.use(getLista(pagina([lancamento('l1')])));
      renderApp(ROTA, 'Client');

      const main = await screen.findByRole('main');
      await screen.findByText('Lançamento l1');
      expect(within(main).getByRole('link', { name: 'Minhas obras' })).toHaveAttribute('href', '/cliente');

      const financeiro = screen.getByRole('link', { name: 'Financeiro' });
      expect(financeiro).toHaveAttribute('aria-current', 'page');
      expect(financeiro).toHaveAttribute('href', `/cliente/obras/${OBRA_ID}/financeiro`);

      const nomes = screen
        .getAllByRole('link')
        .map((l) => l.textContent?.trim())
        .filter(Boolean);
      const iFechamento = nomes.indexOf('Fechamento');
      expect(iFechamento).toBeGreaterThanOrEqual(0);
      expect(nomes[iFechamento + 1]).toBe('Financeiro');
    });
  });
});
