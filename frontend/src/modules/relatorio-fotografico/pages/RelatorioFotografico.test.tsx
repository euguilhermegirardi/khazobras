import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Etapa } from '@/interfaces/etapa';
import type { Foto, RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const OBRA_ID = '22222222-2222-2222-2222-222222222222';
const ETAPA_ID = '33333333-3333-3333-3333-333333333333';
const ROTA = `/cliente/obras/${OBRA_ID}/relatorio-fotografico`;
const TOKEN = 'token-falso-de-teste';

const foto = (id: string, over: Partial<Foto> = {}): Foto => ({
  id,
  dataFoto: '2026-03-10',
  descricao: `Foto ${id}`,
  ordem: 1,
  createdAt: '2026-03-11T12:00:00Z',
  ...over,
});

const relatorio = (over: Partial<RelatorioFotografico> = {}): RelatorioFotografico => ({
  id: 'rf1',
  obraId: OBRA_ID,
  tipo: 'mensal',
  etapaId: null,
  titulo: 'Relatório de fevereiro',
  competencia: '2026-02-01',
  createdAt: '2026-03-01T12:00:00Z',
  fotos: [foto('f1')],
  ...over,
});

const etapa = (over: Partial<Etapa> = {}): Etapa => ({
  id: ETAPA_ID,
  obraId: OBRA_ID,
  nome: 'Fundação',
  ordem: 1,
  ...over,
});

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const getLista = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/relatorios-fotograficos`, () => HttpResponse.json(body as never, { status }));
const getEtapas = (body: unknown = [], status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json(body as never, { status }));
const getArquivo = (auth?: string[]) =>
  http.get(`${API}/fotos/:fotoId/arquivo`, ({ request }) => {
    auth?.push(request.headers.get('authorization') ?? '');
    return new HttpResponse(PNG, { headers: { 'Content-Type': 'image/png' } });
  });

let contador = 0;
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  contador = 0;
  createObjectURL.mockReset();
  createObjectURL.mockImplementation(() => `blob:http://localhost/foto-${(contador += 1)}`);
  revokeObjectURL.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Relatório fotográfico (cliente)', () => {
  it('mostra carregando e depois os relatórios mensais do mês mais novo para o mais antigo', async () => {
    server.use(
      getLista([
        relatorio({ id: 'a', competencia: '2026-02-01', titulo: 'Fev', fotos: [foto('f1')] }),
        relatorio({ id: 'b', competencia: '2026-03-01', titulo: 'Mar', fotos: [foto('f2')] }),
      ]),
      getEtapas(),
      getArquivo(),
    );
    renderApp(ROTA, 'Client');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatórios fotográficos');
    expect(await screen.findByRole('heading', { name: 'Março de 2026' })).toBeInTheDocument();

    const meses = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.toLowerCase());
    expect(meses).toEqual(['março de 2026', 'fevereiro de 2026']);
  });

  it('mostra a aba Etapa com o nome vindo de etapas', async () => {
    server.use(
      getLista([
        relatorio({
          id: 'e1',
          tipo: 'etapa',
          etapaId: ETAPA_ID,
          competencia: null,
          titulo: 'Fotos da obra',
          fotos: [foto('f9')],
        }),
      ]),
      getEtapas([etapa()]),
      getArquivo(),
    );
    renderApp(ROTA, 'Client');
    await screen.findByRole('tab', { name: 'Etapa' });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByRole('heading', { name: 'Fundação' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Ampliar foto: Foto f9' })).toBeInTheDocument();
  });

  it('usa o título do relatório quando a etapa não é encontrada ou etapas falha', async () => {
    server.use(
      getLista([
        relatorio({
          id: 'e1',
          tipo: 'etapa',
          etapaId: ETAPA_ID,
          competencia: null,
          titulo: 'Acabamento externo',
          fotos: [],
        }),
      ]),
      getEtapas({ requestId: 'req-etapas', message: 'Erro' }, 500),
    );
    renderApp(ROTA, 'Client');
    await screen.findByRole('tab', { name: 'Etapa' });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByRole('heading', { name: 'Acabamento externo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra vazio por aba, cada uma com sua mensagem', async () => {
    server.use(
      getLista([
        relatorio({ id: 'e1', tipo: 'etapa', etapaId: ETAPA_ID, competencia: null, titulo: 'Fundação', fotos: [] }),
      ]),
      getEtapas([etapa()]),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/Nenhum relatório fotográfico mensal foi publicado ainda/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByRole('heading', { name: 'Fundação' })).toBeInTheDocument();
    expect(screen.getByText('Este relatório ainda não tem fotos.')).toBeInTheDocument();
  });

  it('mostra vazio na aba Etapa quando só há mensais', async () => {
    server.use(getLista([relatorio({ fotos: [] })]), getEtapas());
    renderApp(ROTA, 'Client');
    await screen.findByRole('heading', { name: 'Fevereiro de 2026' });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByText(/Nenhum relatório fotográfico por etapa foi publicado ainda/)).toBeInTheDocument();
  });

  it('lista vazia: mensagem em ambas as abas', async () => {
    server.use(getLista([]), getEtapas());
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/Nenhum relatório fotográfico mensal/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByText(/Nenhum relatório fotográfico por etapa/)).toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e permite tentar de novo', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/relatorios-fotograficos`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-500', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json([relatorio()]);
      }),
      getEtapas(),
      getArquivo(),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-500');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Fevereiro de 2026' })).toBeInTheDocument();
  });

  it('erro 403 mostra mensagem de sem permissão e nenhuma foto', async () => {
    server.use(getLista({}, 403), getEtapas({}, 403));
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('foto que falha mostra "Imagem indisponível" e não derruba as outras', async () => {
    server.use(
      getLista([relatorio({ fotos: [foto('boa', { ordem: 1 }), foto('ruim', { ordem: 2 })] })]),
      getEtapas(),
      http.get(`${API}/fotos/boa/arquivo`, () => new HttpResponse(PNG, { headers: { 'Content-Type': 'image/png' } })),
      http.get(`${API}/fotos/ruim/arquivo`, () => HttpResponse.json({ message: 'nf' }, { status: 404 })),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByText('Imagem indisponível')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Ampliar foto: Foto boa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ampliar foto: Foto ruim' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('imagens só apontam para blob: e a requisição leva Bearer', async () => {
    const auth: string[] = [];
    server.use(
      getLista([relatorio({ fotos: [foto('f1', { ordem: 1 }), foto('f2', { ordem: 2 })] })]),
      getEtapas(),
      getArquivo(auth),
    );
    renderApp(ROTA, 'Client');

    await screen.findByRole('button', { name: 'Ampliar foto: Foto f1' });
    await screen.findByRole('button', { name: 'Ampliar foto: Foto f2' });

    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      const src = img.getAttribute('src') ?? '';
      expect(src.startsWith('blob:')).toBe(true);
      expect(src).not.toContain(API);
      expect(src).not.toMatch(/r2|cloudflare|amazonaws/i);
    }
    expect(auth).toHaveLength(2);
    expect(auth.every((h) => h === `Bearer ${TOKEN}`)).toBe(true);
  });

  it('ampliar abre diálogo, Esc fecha e o foco volta à miniatura', async () => {
    server.use(getLista([relatorio()]), getEtapas(), getArquivo());
    renderApp(ROTA, 'Client');
    const user = userEvent.setup();

    const miniatura = await screen.findByRole('button', { name: 'Ampliar foto: Foto f1' });
    await user.click(miniatura);

    const dialog = screen.getByRole('dialog', { name: 'Foto f1' });
    expect(within(dialog).getByRole('img').getAttribute('src')).toMatch(/^blob:/);
    expect(within(dialog).getByRole('button', { name: 'Fechar' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ampliar foto: Foto f1' })).toHaveFocus();
  });

  it('o botão Fechar também fecha o diálogo', async () => {
    server.use(getLista([relatorio()]), getEtapas(), getArquivo());
    renderApp(ROTA, 'Client');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Ampliar foto: Foto f1' }));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('revoga os object URLs ao desmontar a tela', async () => {
    server.use(getLista([relatorio({ fotos: [foto('f1')] })]), getEtapas(), getArquivo());
    const { unmount } = renderApp(ROTA, 'Client');
    await screen.findByRole('button', { name: 'Ampliar foto: Foto f1' });
    const criados = createObjectURL.mock.results.map((r) => r.value as string);
    expect(criados.length).toBeGreaterThan(0);

    unmount();
    for (const url of criados) expect(revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it('é somente leitura: sem upload, editar, excluir ou criar', async () => {
    server.use(getLista([relatorio()]), getEtapas(), getArquivo());
    const { container } = renderApp(ROTA, 'Client');
    await screen.findByRole('button', { name: 'Ampliar foto: Foto f1' });

    expect(
      screen.queryByRole('button', { name: /enviar|upload|criar|novo|adicionar|editar|excluir|remover|publicar/i }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('mostra o texto da descrição como texto, sem interpretar HTML', async () => {
    server.use(
      getLista([relatorio({ fotos: [foto('f1', { descricao: '<b>negrito</b>' })] })]),
      getEtapas(),
      getArquivo(),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/<b>negrito<\/b>/)).toBeInTheDocument();
  });

  it('tem "← Minhas obras" e o item Relatório fotográfico ativo na sidebar', async () => {
    server.use(getLista([relatorio()]), getEtapas(), getArquivo());
    renderApp(ROTA, 'Client');

    const main = await screen.findByRole('main');
    expect(within(main).getByRole('link', { name: 'Minhas obras' })).toHaveAttribute('href', '/cliente');
    const ativo = screen.getAllByRole('link', { name: 'Relatório fotográfico' });
    expect(ativo.some((l) => l.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('master não entra na rota do cliente', async () => {
    renderApp(ROTA, 'Master');
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
  });

  it('admin não entra na rota do cliente', async () => {
    renderApp(ROTA, 'Admin');
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
  });

  it('deslogado é enviado ao login', async () => {
    renderApp(ROTA);
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });
});
