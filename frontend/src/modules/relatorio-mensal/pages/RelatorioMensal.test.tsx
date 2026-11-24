import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { RelatorioMensal } from '@/interfaces/relatorioMensal';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const OBRA_ID = '22222222-2222-2222-2222-222222222222';
const ROTA = `/cliente/obras/${OBRA_ID}/relatorio-mensal`;

const relatorio = (over: Partial<RelatorioMensal> = {}): RelatorioMensal => ({
  id: 'r1',
  obraId: OBRA_ID,
  competencia: '2026-02-01',
  conteudo: 'Fundação concluída.\nInício da alvenaria.',
  status: 'published',
  publishedAt: '2026-03-02T15:00:00Z',
  createdAt: '2026-03-01T12:00:00Z',
  ...over,
});

const getLista = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, ({ request }) => {
    // O cliente só pode pedir os publicados.
    expect(new URL(request.url).searchParams.get('onlyPublished')).toBe('true');
    return HttpResponse.json(body as never, { status });
  });

describe('Relatório mensal (cliente)', () => {
  it('mostra carregando e depois os relatórios do mês mais novo para o mais antigo', async () => {
    server.use(
      getLista([relatorio(), relatorio({ id: 'r2', competencia: '2026-03-01', conteudo: 'Telhado em andamento.' })]),
    );
    renderApp(ROTA, 'Client');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatórios');
    expect(await screen.findByText('Telhado em andamento.')).toBeInTheDocument();

    const meses = screen.getAllByText(/de 2026$/i).map((el) => el.textContent?.toLowerCase());
    expect(meses).toEqual(['março de 2026', 'fevereiro de 2026']);
    expect(screen.getAllByText(/Publicado em/)).toHaveLength(2);
  });

  it('mostra o texto como texto, sem interpretar HTML', async () => {
    server.use(getLista([relatorio({ conteudo: '<b>negrito</b>' })]));
    renderApp(ROTA, 'Client');

    expect(await screen.findByText('<b>negrito</b>')).toBeInTheDocument();
  });

  it('renderiza o Markdown do relatório (título, negrito, itálico e listas) para o cliente', async () => {
    server.use(
      getLista([
        relatorio({ conteudo: '## Resumo\n\nObra **adiantada** e *sem* atrasos.\n\n- Pisos\n\n1. Alvenaria' }),
      ]),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument();
    expect(document.querySelector('strong')).toHaveTextContent('adiantada');
    expect(document.querySelector('em')).toHaveTextContent('sem');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining(['Pisos', 'Alvenaria']),
    );
    // Só o título da página é h1: o Markdown nunca cria outro.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('HTML, script, link e imagem no texto não viram elementos para o cliente', async () => {
    server.use(
      getLista([
        relatorio({
          conteudo: '<script>alert(1)</script> <img src=x onerror=alert(2)> [x](javascript:alert(3)) ![y](a.png) fim',
        }),
      ]),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/fim$/)).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main.querySelector('script, img, [onerror], [href^="javascript"]')).toBeNull();
    expect(within(main).queryByRole('link', { name: 'x' })).not.toBeInTheDocument();
    expect(main).toHaveTextContent('<script>alert(1)</script>');
  });

  it('cliente: relatório de 20000 caracteres e outro hostil convivem, sem editor, barra nem elementos perigosos', async () => {
    const longo = `${'Obra **ok** e *bem*. '.repeat(900)}FIM-LONGO`;
    expect(longo.length).toBeLessThanOrEqual(20000);
    server.use(
      getLista([
        relatorio({ id: 'r1', competencia: '2026-03-01', conteudo: longo }),
        relatorio({
          id: 'r2',
          competencia: '2026-02-01',
          conteudo:
            '# Grande\n\n<iframe src="https://evil.example"></iframe> [a](javascript:alert(1)) ![i](http://x/y.png) &lt;b&gt;',
        }),
      ]),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/FIM-LONGO/)).toBeInTheDocument();
    const main = screen.getByRole('main');
    await waitFor(() => expect(within(main).getByRole('heading', { level: 2, name: 'Grande' })).toBeInTheDocument());
    expect(
      main.querySelector('iframe, img, script, textarea, [role="toolbar"], a[href^="javascript"], a[href^="http"]'),
    ).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(main).toHaveTextContent('<iframe src="https://evil.example"></iframe>');
    expect(within(main).queryByRole('tab')).not.toBeInTheDocument();
  });

  it('texto antigo (sem marcação) aparece igual, com as quebras de linha', async () => {
    server.use(getLista([relatorio({ conteudo: 'Linha 1\nLinha 2' })]));
    renderApp(ROTA, 'Client');

    // O "\n" fica no texto (o CSS `whitespace-pre-line` o mostra como quebra); nada é juntado nem perdido.
    const paragrafo = (await screen.findByText(/Linha 1/)) as HTMLElement;
    expect(paragrafo.textContent).toBe('Linha 1\nLinha 2');
  });

  it('mostra mensagem útil quando não há relatório publicado', async () => {
    server.use(getLista([]));
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/Nenhum relatório foi publicado ainda/)).toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e permite tentar de novo', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-500', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json([relatorio()]);
      }),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-500');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText(/Fundação concluída/)).toBeInTheDocument();
  });

  it('erro 403 mostra mensagem de sem permissão', async () => {
    server.use(getLista({}, 403));
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
  });

  it('é somente leitura: sem botões de escrita', async () => {
    server.use(getLista([relatorio()]));
    renderApp(ROTA, 'Client');
    await screen.findByText(/Fundação concluída/);

    expect(screen.queryByRole('button', { name: /criar|novo|editar|excluir|publicar/i })).not.toBeInTheDocument();
  });

  it('não exibe ids internos nem rascunho/status técnico ao cliente', async () => {
    server.use(getLista([relatorio()]));
    renderApp(ROTA, 'Client');
    await screen.findByText(/Fundação concluída/);

    expect(screen.queryByText(/draft|rascunho|createdBy/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('r1');
  });

  it('master também não entra na rota do cliente', async () => {
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
