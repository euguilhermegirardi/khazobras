import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import { relatorio, ROTA_LISTA, ROTA_NOVO, rotaDetalhe, servidorRelatorios, TOKEN } from '@/test/relatorioAdmin';
import { server } from '@/test/server';

/**
 * Limites e casos hostis do editor de Markdown (texto de até 20000 caracteres): formatação que passa do limite,
 * caracteres de direção do texto colados, envio exatamente como digitado e resumo da lista em texto simples.
 * Obs.: o `<textarea>` normaliza "\r\n" para "\n" no valor (navegador e jsdom), então o texto enviado nunca tem "\r".
 */
const user = () => userEvent.setup();
const conteudoInput = () => screen.getByLabelText('Conteúdo') as HTMLTextAreaElement;
const botao = (nome: string) => screen.getByRole('button', { name: nome });
const previaCliente = () => screen.getByRole('region', { name: 'Como o cliente vê' });
const MAX = 20000;
const ERRO_LIMITE = `O conteúdo aceita no máximo ${MAX} caracteres.`;
const ERRO_CARACTERE = 'O conteúdo não pode ter caracteres de controle nem de direção do texto.';

const selecionar = (inicio: number, fim = inicio) => {
  conteudoInput().focus();
  conteudoInput().setSelectionRange(inicio, fim);
};

const abrirNovo = async () => {
  const api = servidorRelatorios([]);
  server.use(...api.handlers);
  renderApp(ROTA_NOVO, 'Admin');
  await screen.findByLabelText('Conteúdo');
  fireEvent.change(screen.getByLabelText('Competência (mês)'), { target: { value: '2026-11' } });
  return api;
};

describe('Editor Markdown - limite de 20000 caracteres', () => {
  it('formatar um texto de 19999 caracteres passa do limite: contador avisa, salvar é barrado e desfazer libera', async () => {
    const api = await abrirNovo();
    const u = user();
    fireEvent.change(conteudoInput(), { target: { value: 'x'.repeat(MAX - 1) } });
    expect(screen.getByText(`${MAX - 1}/${MAX}`)).toBeInTheDocument();

    selecionar(0, MAX - 1);
    await u.click(botao('Negrito'));

    // O botão não corta o texto nem finge que coube: o contador mostra o excesso (região aria-live).
    expect(conteudoInput().value).toHaveLength(MAX + 3);
    const contador = screen.getByText(`${MAX + 3}/${MAX}`);
    expect(contador).toHaveAttribute('aria-live', 'polite');

    await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));
    expect(await screen.findByText(ERRO_LIMITE)).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);

    // Desfazer o negrito (alternar) volta a caber e o envio passa.
    await u.click(botao('Negrito'));
    expect(conteudoInput().value).toHaveLength(MAX - 1);
    await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));
    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]?.body.conteudo).toBe('x'.repeat(MAX - 1));
  });

  it('exatamente 20000 caracteres depois de formatar é aceito e enviado inteiro', async () => {
    const api = await abrirNovo();
    fireEvent.change(conteudoInput(), { target: { value: 'x'.repeat(MAX - 4) } });
    selecionar(0, MAX - 4);

    await user().click(botao('Negrito'));
    expect(conteudoInput().value).toHaveLength(MAX);
    await user().click(screen.getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]?.body.conteudo).toBe(`**${'x'.repeat(MAX - 4)}**`);
    expect(screen.queryByText(ERRO_LIMITE)).not.toBeInTheDocument();
  });

  it('título numa linha de 20000 caracteres passa do limite e também é barrado', async () => {
    const api = await abrirNovo();
    fireEvent.change(conteudoInput(), { target: { value: 'y'.repeat(MAX) } });
    selecionar(5);

    await user().click(botao('Título'));
    expect(conteudoInput().value).toHaveLength(MAX + 3);
    await user().click(screen.getByRole('button', { name: 'Criar rascunho' }));

    expect(await screen.findByText(ERRO_LIMITE)).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('20000 caracteres de Markdown com muita formatação: a aba Pré-visualizar abre e renderiza tudo', async () => {
    await abrirNovo();
    const md = '**a** *b* '.repeat(MAX / 10);
    expect(md.length).toBe(MAX);

    fireEvent.change(conteudoInput(), { target: { value: md } });
    await user().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    const painel = screen.getByRole('tabpanel', { name: 'Pré-visualizar' });
    expect(painel.querySelectorAll('strong')).toHaveLength(MAX / 10);
    expect(screen.getByText(`${MAX}/${MAX}`)).toBeInTheDocument();
  });
});

describe('Editor Markdown - texto patológico e entidades', () => {
  it('colar 20000 caracteres de citações aninhadas não derruba o formulário: prévia mostra o texto e salvar envia o cru', async () => {
    const api = await abrirNovo();
    const patologico = '> '.repeat(MAX / 2);

    fireEvent.change(conteudoInput(), { target: { value: patologico } });

    expect(screen.getByText(`${MAX}/${MAX}`)).toBeInTheDocument();
    await user().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));
    expect(screen.getByRole('tabpanel', { name: 'Pré-visualizar' }).textContent).toBe(patologico);
    expect(within(previaCliente()).getByText(/^>/)).toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: 'Criar rascunho' }));
    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]?.body.conteudo).toBe(patologico);
  });

  it('entidade de direção do texto (&#x202E;) é aceita como texto, mas nunca chega ao DOM da prévia nem ao do cliente', async () => {
    await abrirNovo();
    const u = user();

    fireEvent.change(conteudoInput(), { target: { value: 'relatório A&#x202E;B&rlm;C ok' } });
    await u.click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    const painel = screen.getByRole('tabpanel', { name: 'Pré-visualizar' });
    expect(painel).toHaveTextContent('relatório ABC ok');
    expect(painel.textContent).not.toMatch(/[​-‏‪-‮⁦-⁩]/);
    expect(previaCliente().textContent).not.toMatch(/[​-‏‪-‮⁦-⁩]/);
  });
});

describe('Editor Markdown - caracteres proibidos colados', () => {
  it('colar caractere de direção do texto (U+202E) é recusado ao salvar, com a mensagem no campo', async () => {
    const api = await abrirNovo();
    const u = user();
    conteudoInput().focus();

    await u.paste('relatório ‮fdp.exe ok');
    expect(conteudoInput()).toHaveValue('relatório ‮fdp.exe ok');
    await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));

    expect(await screen.findByText(ERRO_CARACTERE)).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('cada caractere de direção e de controle proibido bloqueia; Tab e quebra de linha passam', async () => {
    const api = await abrirNovo();
    const u = user();
    const proibidos = ['‪', '‫', '‬', '‭', '‮', '⁦', '⁧', '⁨', '⁩', '\u0000', '\u0007', '\u007F', '\u0085'];

    for (const caractere of proibidos) {
      fireEvent.change(conteudoInput(), { target: { value: `texto ${caractere} texto` } });
      await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));
      await screen.findByText(ERRO_CARACTERE);
      expect(api.chamadas.criar, `U+${caractere.charCodeAt(0).toString(16).padStart(4, '0')}`).toHaveLength(0);
    }

    fireEvent.change(conteudoInput(), { target: { value: 'a\tb\nc\n\nd' } });
    await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));
    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]?.body.conteudo).toBe('a\tb\nc\n\nd');
  });

  it('formatar um texto que já tem caractere proibido não esconde o erro: continua barrado', async () => {
    const api = await abrirNovo();
    const u = user();
    fireEvent.change(conteudoInput(), { target: { value: 'ok ‮ ruim' } });
    selecionar(0, 2);

    await u.click(botao('Negrito'));
    await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));

    expect(await screen.findByText(ERRO_CARACTERE)).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });
});

describe('Editor Markdown - envio exatamente como digitado', () => {
  // Espaços no fim da linha (quebra forçada), tabs e linhas em branco no começo/fim não podem ser "limpos".
  const CRU = '\n\n## Título  \n\n- a\t\n- **b**   \n\n1. um\n2. dois\n\nfim com <b>html</b> e &amp;  \n\n';

  it('criar rascunho manda o conteúdo sem trim, sem normalizar espaços e sem converter marcação', async () => {
    const api = await abrirNovo();
    fireEvent.change(conteudoInput(), { target: { value: CRU } });

    await user().click(screen.getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]).toEqual({
      auth: `Bearer ${TOKEN}`,
      body: { obraId: expect.any(String), competencia: '2026-11-01', conteudo: CRU },
    });
  });

  it('salvar edição manda o mesmo texto cru e publicar depois não reescreve o conteúdo', async () => {
    const api = servidorRelatorios([relatorio('r1', { competencia: '2026-10-01', conteudo: 'antigo' })]);
    server.use(...api.handlers);
    renderApp(rotaDetalhe('r1'), 'Admin');
    await screen.findByRole('heading', { name: /^Relatório de /, level: 1 });
    const u = user();

    fireEvent.change(conteudoInput(), { target: { value: CRU } });
    await u.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body).toEqual({ competencia: '2026-10-01', conteudo: CRU });

    await u.click(screen.getByRole('button', { name: 'Publicar' }));
    await u.click(screen.getByRole('button', { name: 'Publicar agora' }));
    expect(await screen.findByText('Relatório publicado. O cliente já pode vê-lo.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument());

    expect(api.chamadas.publicar).toHaveLength(1);
    expect(api.chamadas.editar).toHaveLength(1);
    expect(api.relatorios()[0]?.conteudo).toBe(CRU);
    // Publicado: o cartão do cliente renderiza o Markdown.
    const cartao = await screen.findByRole('region', { name: 'Como o cliente vê' });
    expect(within(cartao).getByRole('heading', { level: 2, name: 'Título' })).toBeInTheDocument();
    expect(cartao.querySelector('strong')).toHaveTextContent('b');
    expect(cartao.querySelector('b')).toBeNull();
  });

  it('criar, abrir o rascunho e salvar de novo sem mexer devolve exatamente o mesmo texto (ida e volta)', async () => {
    const api = await abrirNovo();
    fireEvent.change(conteudoInput(), { target: { value: CRU } });
    await user().click(screen.getByRole('button', { name: 'Criar rascunho' }));
    await screen.findByText('Rascunho criado. O cliente só vê depois de publicar.');

    await waitFor(() => expect(conteudoInput()).toHaveValue(CRU));
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body.conteudo).toBe(CRU);
  });
});

describe('Lista de relatórios - resumo em texto simples', () => {
  const casos = [
    { competencia: '2026-01-01', conteudo: '**obra *quase* pronta** e *ok*' },
    { competencia: '2026-02-01', conteudo: `## Título\n\n${'palavra **x** '.repeat(1400)}` },
    { competencia: '2026-03-01', conteudo: '**aberto [link](http://x e *solto' },
    { competencia: '2026-04-01', conteudo: '> '.repeat(MAX / 2) },
    { competencia: '2026-05-01', conteudo: '[a](javascript:alert(1)) <script>x</script> ![i](http://x/y.png)' },
    { competencia: '2026-06-01', conteudo: '* '.repeat(MAX / 2) },
  ];

  it('markdown aninhado, quebrado ou de 20000 caracteres vira uma linha curta, sem marcadores nem elementos', async () => {
    server.use(
      ...servidorRelatorios(casos.map((c, i) => relatorio(`r${i + 1}`, { ...c, conteudo: c.conteudo.slice(0, MAX) })))
        .handlers,
    );
    renderApp(ROTA_LISTA, 'Admin');

    const tabela = await screen.findByRole('table');
    const celula = (mes: string) =>
      within(tabela)
        .getByRole('link', { name: `Abrir relatório de ${mes}` })
        .closest('tr')
        ?.querySelector('td[title]') as HTMLElement;

    expect(celula('Janeiro de 2026')).toHaveTextContent('obra quase pronta e ok');
    expect(celula('Janeiro de 2026').textContent).not.toContain('*');

    const longo = celula('Fevereiro de 2026');
    expect(longo.textContent?.length).toBeLessThanOrEqual(200);
    expect(longo.textContent?.startsWith('Título palavra x palavra x')).toBe(true);
    expect(longo.textContent).not.toMatch(/[*#]/);
    expect(longo).toHaveAttribute('title', longo.textContent ?? '');

    expect(celula('Março de 2026')).toHaveTextContent(/^\*\*aberto/);
    expect(celula('Maio de 2026')).toHaveTextContent('a <script>x</script> i');
    expect(celula('Abril de 2026').textContent?.length).toBeLessThanOrEqual(200);
    expect(celula('Junho de 2026').textContent?.length).toBeLessThanOrEqual(200);
    expect(tabela.querySelector('script, img, a[href^="javascript"], strong, em, h2, ul, ol')).toBeNull();
  });
});
