import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import { OBRA_ID, publicado, relatorio, ROTA_LISTA, ROTA_NOVO, servidorRelatorios, TOKEN } from '@/test/relatorioAdmin';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();
const mesInput = () => screen.getByLabelText('Competência (mês)') as HTMLInputElement;
const conteudoInput = () => screen.getByLabelText('Conteúdo') as HTMLTextAreaElement;
const botaoCriar = () => screen.getByRole('button', { name: 'Criar rascunho' });
const previa = () => screen.getByRole('region', { name: 'Como o cliente vê' });

const preencher = (mes: string, conteudo: string) => {
  fireEvent.change(mesInput(), { target: { value: mes } });
  fireEvent.change(conteudoInput(), { target: { value: conteudo } });
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Relatório ao cliente (admin) - novo', () => {
  it('mostra o título, os campos rotulados, o contador e o botão "Criar rascunho"', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');

    expect(await screen.findByRole('heading', { name: 'Novo relatório ao cliente', level: 1 })).toBeInTheDocument();
    expect(mesInput()).toHaveAttribute('type', 'month');
    expect(conteudoInput().tagName).toBe('TEXTAREA');
    expect(screen.getByText('0/20000')).toBeInTheDocument();
    expect(botaoCriar()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Relatórios/ })).toHaveAttribute('href', ROTA_LISTA);
  });

  it('a competência começa no mês de hoje', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0));
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');

    await screen.findByRole('heading', { name: 'Novo relatório ao cliente' });
    expect(mesInput()).toHaveValue('2026-11');
    expect(within(previa()).getByText('Novembro de 2026')).toBeInTheDocument();
  });

  it('o contador acompanha o que se digita', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    await user().type(conteudoInput(), 'Olá, obra');

    expect(screen.getByText('9/20000')).toBeInTheDocument();
  });

  it('conteúdo vazio ou só espaços: "Escreva o conteúdo do relatório." e nenhuma chamada', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');
    const u = user();

    await u.click(botaoCriar());
    expect(await screen.findByText('Escreva o conteúdo do relatório.')).toBeInTheDocument();

    fireEvent.change(conteudoInput(), { target: { value: '   \n\t ' } });
    await u.click(botaoCriar());
    expect(await screen.findByText('Escreva o conteúdo do relatório.')).toBeInTheDocument();
    expect(conteudoInput()).toHaveAccessibleDescription('Escreva o conteúdo do relatório.');
    expect(conteudoInput()).toBeInvalid();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('competência vazia: "Informe o mês do relatório." e nenhuma chamada', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('', 'Texto válido');
    await user().click(botaoCriar());

    expect(await screen.findByText('Informe o mês do relatório.')).toBeInTheDocument();
    expect(mesInput()).toHaveAccessibleDescription('Informe o mês do relatório.');
    expect(api.chamadas.criar).toHaveLength(0);
    // Sem mês, a prévia pede o mês em vez de mostrar um título inválido.
    expect(within(previa()).getByText('Escolha o mês para ver a pré-visualização.')).toBeInTheDocument();
  });

  it('20001 caracteres: contador vermelho de aviso, erro do limite e nenhuma chamada', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'a'.repeat(20001));
    expect(screen.getByText('20001/20000')).toBeInTheDocument();
    await user().click(botaoCriar());

    expect(await screen.findByText('O conteúdo aceita no máximo 20000 caracteres.')).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('exatamente 20000 caracteres é aceito e enviado inteiro', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'a'.repeat(20000));
    expect(screen.getByText('20000/20000')).toBeInTheDocument();
    await user().click(botaoCriar());

    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(String(api.chamadas.criar[0]?.body.conteudo)).toHaveLength(20000);
  });

  it.each([
    ['caractere de controle (U+0007)', 'texto\u0007com sino'],
    ['inversão de direção do texto (U+202E)', 'texto‮invertido'],
    ['isolado de direção (U+2066)', 'texto⁦isolado'],
  ])('recusa %s e não chama a API', async (_nome, texto) => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', texto);
    await user().click(botaoCriar());

    expect(
      await screen.findByText('O conteúdo não pode ter caracteres de controle nem de direção do texto.'),
    ).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('quebra de linha e tabulação são aceitas', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Linha 1\r\nLinha 2\t- ok');
    await user().click(botaoCriar());

    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
  });

  it('cria o rascunho: POST com obraId, competência no dia 1 e o texto SEM aparar; abre o detalhe com o aviso', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');
    const texto = '  Fundação concluída.\n\nPróximos passos: alvenaria.  \n';

    preencher('2026-11', texto);
    await user().click(botaoCriar());

    expect(await screen.findByText('Rascunho criado. O cliente só vê depois de publicar.')).toBeInTheDocument();
    expect(api.chamadas.criar).toEqual([
      { auth: `Bearer ${TOKEN}`, body: { obraId: OBRA_ID, competencia: '2026-11-01', conteudo: texto } },
    ]);
    // Já está na página do rascunho novo, com os dados do servidor.
    expect(await screen.findByRole('heading', { name: 'Relatório de Novembro de 2026', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(conteudoInput().value).toBe(texto);
  });

  it('mês já usado (409) aparece no campo da competência e o texto digitado continua lá', async () => {
    const api = servidorRelatorios([publicado('r2', { competencia: '2026-11-01' })]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Meu texto');
    await user().click(botaoCriar());

    const erro = 'Já existe um relatório desta obra para este mês. Escolha outro mês ou edite o existente.';
    expect(await screen.findByText(erro)).toBeInTheDocument();
    expect(mesInput()).toHaveAccessibleDescription(erro);
    expect(mesInput()).toBeInvalid();
    expect(conteudoInput()).toHaveValue('Meu texto');
    expect(botaoCriar()).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Novo relatório ao cliente', level: 1 })).toBeInTheDocument();
  });

  it('400 do servidor vai para os campos (Competencia, Conteudo) e ObraId para o alerta geral', async () => {
    server.use(
      http.post(`${API}/relatorios-mensais`, () =>
        HttpResponse.json(
          {
            errors: {
              ObraId: ['A obra e obrigatoria.'],
              Competencia: ['A competencia e invalida.'],
              Conteudo: ['O conteudo e obrigatorio.'],
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Texto');
    await user().click(botaoCriar());

    expect(await screen.findByText('A competencia e invalida.')).toBeInTheDocument();
    expect(screen.getByText('O conteudo e obrigatorio.')).toBeInTheDocument();
    expect(mesInput()).toHaveAccessibleDescription('A competencia e invalida.');
    expect(conteudoInput()).toHaveAccessibleDescription('O conteudo e obrigatorio.');
    expect(screen.getByRole('alert')).toHaveTextContent('A obra e obrigatoria.');
  });

  it('403 ao criar mostra "sem permissão" e mantém o formulário', async () => {
    server.use(http.post(`${API}/relatorios-mensais`, () => HttpResponse.json({}, { status: 403 })));
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Texto');
    await user().click(botaoCriar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
    expect(conteudoInput()).toHaveValue('Texto');
  });

  it('404 da obra ao criar mostra mensagem útil', async () => {
    server.use(http.post(`${API}/relatorios-mensais`, () => HttpResponse.json({}, { status: 404 })));
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Texto');
    await user().click(botaoCriar());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este relatório não foi encontrado. Volte à lista e atualize a página.',
    );
  });

  it('500 ao criar mostra o código de suporte e mantém o texto para tentar de novo', async () => {
    server.use(
      http.post(`${API}/relatorios-mensais`, () =>
        HttpResponse.json({ requestId: 'req-criar', message: 'Erro interno' }, { status: 500 }),
      ),
    );
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Texto importante');
    await user().click(botaoCriar());

    expect(await screen.findByRole('alert')).toHaveTextContent('req-criar');
    expect(conteudoInput()).toHaveValue('Texto importante');
    expect(botaoCriar()).toBeEnabled();
  });

  it('clique duplo em "Criar rascunho" envia uma única vez (botão trava em "Salvando…")', async () => {
    const api = servidorRelatorios([]);
    server.use(
      http.post(`${API}/relatorios-mensais`, async () => {
        await delay(80);
        return undefined;
      }),
      ...api.handlers,
    );
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');
    preencher('2026-11', 'Texto');
    const u = user();

    await u.click(botaoCriar());
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled();
    await u.click(screen.getByRole('button', { name: 'Salvando…' }));

    await screen.findByText('Rascunho criado. O cliente só vê depois de publicar.');
    expect(api.chamadas.criar).toHaveLength(1);
  });

  it('a prévia "Como o cliente vê" mostra o HTML digitado como texto, nunca como elemento', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', '<b>negrito</b><script>alert(1)</script><img src=x onerror=alert(1)>');

    const texto = '<b>negrito</b><script>alert(1)</script><img src=x onerror=alert(1)>';
    expect(within(previa()).getByText(texto)).toBeInTheDocument();
    expect(previa().querySelector('b, script, img')).toBeNull();
  });

  it('a prévia mostra o texto de apoio vazio, depois o mês e o texto digitados, sem "Publicado em"', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    expect(within(previa()).getByText('O texto aparece aqui enquanto você escreve.')).toBeInTheDocument();
    preencher('2027-02', 'Linha A\nLinha B');

    const p = previa();
    expect(within(p).getByText('Fevereiro de 2027')).toBeInTheDocument();
    expect(p.textContent).toContain('Linha A\nLinha B');
    expect(within(p).queryByText(/Publicado em/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pré-visualização do texto digitado, sem salvar/)).toBeInTheDocument();
  });

  it('"Cancelar" volta para a lista sem criar nada', async () => {
    const api = servidorRelatorios([relatorio('r1')]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    preencher('2026-11', 'Texto');
    await user().click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { name: 'Relatório ao cliente', level: 1 })).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('depois de criar, a lista já mostra o rascunho novo (cache relido)', async () => {
    const api = servidorRelatorios([relatorio('r1', { competencia: '2026-10-01' })]);
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');
    const u = user();

    await u.click(screen.getByRole('link', { name: '+ Novo relatório' }));
    await screen.findByLabelText('Conteúdo');
    preencher('2026-12', 'Texto de dezembro');
    await u.click(botaoCriar());
    await screen.findByRole('heading', { name: 'Relatório de Dezembro de 2026', level: 1 });
    await u.click(screen.getAllByRole('link', { name: /Relatórios/ }).at(-1) as HTMLElement);

    expect(await screen.findByRole('link', { name: 'Abrir relatório de Dezembro de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).toBeInTheDocument();
  });
});
