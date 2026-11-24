import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  publicado,
  relatorio,
  ROTA_LISTA,
  ROTA_NOVO,
  rotaDetalhe,
  servidorRelatorios,
  TOKEN,
} from '@/test/relatorioAdmin';
import { server } from '@/test/server';

const user = () => userEvent.setup();
const conteudoInput = () => screen.getByLabelText('Conteúdo') as HTMLTextAreaElement;
const previa = () => screen.getByRole('region', { name: 'Como o cliente vê' });
const botao = (nome: string) => screen.getByRole('button', { name: nome });

const selecionar = (inicio: number, fim = inicio) => {
  conteudoInput().focus();
  conteudoInput().setSelectionRange(inicio, fim);
};

const MARKDOWN = '## Resumo\n\nObra **adiantada** e *sem* atrasos.\n\n- Pisos\n- Telhado\n\n1. Alvenaria\n2. Pintura';

describe('Relatório ao cliente (admin) - editor de Markdown', () => {
  it('novo: a barra e as abas aparecem acima do campo "Conteúdo"', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');

    await screen.findByLabelText('Conteúdo');
    expect(screen.getByRole('toolbar', { name: 'Formatação do texto' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Escrever' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Pré-visualizar' })).toBeInTheDocument();
    // O botão do formulário continua sendo o único "submit": nenhum botão da barra envia o formulário.
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('type') === 'submit')).toHaveLength(1);
  });

  it('novo: formata pela barra, a prévia "Como o cliente vê" acompanha e o POST leva o Markdown cru', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');
    const u = user();

    fireEvent.change(screen.getByLabelText('Competência (mês)'), { target: { value: '2026-11' } });
    fireEvent.change(conteudoInput(), { target: { value: 'Obra adiantada' } });
    selecionar(0, 4);
    await u.click(botao('Negrito'));
    selecionar(conteudoInput().value.length);
    await u.keyboard('{Enter}{Enter}');
    await u.click(botao('Lista'));
    await u.keyboard('Pisos');

    expect(conteudoInput()).toHaveValue('**Obra** adiantada\n\n- Pisos');
    expect(previa().querySelector('strong')).toHaveTextContent('Obra');
    expect(within(previa()).getByRole('listitem')).toHaveTextContent('Pisos');
    // O contador conta o texto cru, com os marcadores.
    expect(screen.getByText('27/20000')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Criar rascunho' }));

    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]).toEqual({
      auth: `Bearer ${TOKEN}`,
      body: { obraId: expect.any(String), competencia: '2026-11-01', conteudo: '**Obra** adiantada\n\n- Pisos' },
    });
  });

  it('novo: a aba "Pré-visualizar" mostra o texto como o cliente verá, e o título "#" nunca vira h1', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    fireEvent.change(conteudoInput(), { target: { value: `# Grande\n\n${MARKDOWN}` } });
    await user().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    const painel = screen.getByRole('tabpanel', { name: 'Pré-visualizar' });
    expect(within(painel).getByRole('heading', { level: 2, name: 'Grande' })).toBeInTheDocument();
    expect(within(painel).getAllByRole('list')).toHaveLength(2);
    expect(within(painel).getAllByRole('listitem')).toHaveLength(4);
    expect(painel.querySelector('em')).toHaveTextContent('sem');
    // Só o título da página é h1.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('novo: HTML, script, link e imagem digitados não viram elementos na prévia nem na aba', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');
    const perigoso = '<script>alert(1)</script> <img src=x onerror=alert(2)> [x](javascript:alert(3)) ![y](a.png)';

    fireEvent.change(conteudoInput(), { target: { value: perigoso } });
    await user().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    for (const area of [previa(), screen.getByRole('tabpanel', { name: 'Pré-visualizar' })]) {
      expect(area.querySelector('script, img, a, [onerror], [href]')).toBeNull();
    }
    expect(previa()).toHaveTextContent('<script>alert(1)</script>');
  });

  it('editar: o campo mostra o Markdown cru, a prévia o renderiza e salvar envia o texto formatado', async () => {
    const api = servidorRelatorios([relatorio('r1', { competencia: '2026-10-01', conteudo: MARKDOWN })]);
    server.use(...api.handlers);
    renderApp(rotaDetalhe('r1'), 'Admin');
    await screen.findByRole('heading', { name: /^Relatório de /, level: 1 });

    expect(conteudoInput()).toHaveValue(MARKDOWN);
    expect(within(previa()).getByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument();
    expect(previa().querySelector('strong')).toHaveTextContent('adiantada');

    // Desfaz o negrito de "adiantada" selecionando a palavra (alternar).
    const inicio = MARKDOWN.indexOf('adiantada');
    selecionar(inicio, inicio + 'adiantada'.length);
    await user().click(botao('Negrito'));
    expect(conteudoInput().value).toContain('Obra adiantada e');
    expect(previa().querySelector('strong')).toBeNull();

    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body).toEqual({
      competencia: '2026-10-01',
      conteudo: MARKDOWN.replace('**adiantada**', 'adiantada'),
    });
  });

  it('editar: relatório antigo em texto puro continua legível, com as quebras de linha', async () => {
    const antigo = 'Trabalhos do mês:\nPisos concluídos\nTelhado em andamento';
    server.use(...servidorRelatorios([relatorio('r1', { competencia: '2026-10-01', conteudo: antigo })]).handlers);
    renderApp(rotaDetalhe('r1'), 'Admin');
    await screen.findByRole('heading', { name: /^Relatório de /, level: 1 });

    expect(conteudoInput()).toHaveValue(antigo);
    const paragrafo = previa().querySelector('p');
    expect(paragrafo?.textContent).toBe(antigo);
  });

  it('publicado: renderiza o Markdown como o cliente vê, sem campo editável nem HTML', async () => {
    const api = servidorRelatorios([
      publicado('r2', { conteudo: `${MARKDOWN}\n\n<script>alert(1)</script>[a](javascript:alert(2))` }),
    ]);
    server.use(...api.handlers);
    renderApp(rotaDetalhe('r2'), 'Admin');

    const cartao = await screen.findByRole('region', { name: 'Como o cliente vê' });
    expect(within(cartao).getByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument();
    expect(cartao.querySelector('strong')).toHaveTextContent('adiantada');
    expect(cartao.querySelector('script, a, [href]')).toBeNull();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
  });

  it('lista: o resumo é texto simples, sem ** nem ## nem marcadores de lista', async () => {
    server.use(...servidorRelatorios([relatorio('r1', { competencia: '2026-10-01', conteudo: MARKDOWN })]).handlers);
    renderApp(ROTA_LISTA, 'Admin');

    const tabela = await screen.findByRole('table');
    const resumo = within(tabela).getByTitle(/^Resumo Obra adiantada/);
    expect(resumo).toHaveTextContent('Resumo Obra adiantada e sem atrasos. Pisos Telhado Alvenaria Pintura');
    expect(resumo.textContent).not.toMatch(/[*#]|^- /);
    expect(resumo.querySelector('strong, h2, ul')).toBeNull();
  });
});
