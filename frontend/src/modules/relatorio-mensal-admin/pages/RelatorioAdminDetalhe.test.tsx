import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  AUTOR_ID,
  OUTRA_OBRA_ID,
  publicado,
  registro,
  relatorio,
  rotaDetalhe,
  servidorRelatorios,
  TOKEN,
} from '@/test/relatorioAdmin';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();
const main = () => screen.getByRole('main');
const mesInput = () => screen.getByLabelText('Competência (mês)') as HTMLInputElement;
const conteudoInput = () => screen.getByLabelText('Conteúdo') as HTMLTextAreaElement;
const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TEXTO = 'Trabalhos do mês:\n• Pisos concluídos\n• Telhado em andamento';
const PUBLICAR_PERGUNTA = 'Publicar para o cliente? Depois de publicado não pode ser editado nem excluído.';
const EXCLUIR_PERGUNTA = 'Excluir definitivamente este rascunho?';

const rascunho = () => relatorio('r1', { competencia: '2026-10-01', conteudo: TEXTO });
const abrirRascunho = async (inicial = [rascunho()], historicos = {}) => {
  const api = servidorRelatorios(inicial, { historicos });
  server.use(...api.handlers);
  renderApp(rotaDetalhe('r1'), 'Admin');
  await screen.findByRole('heading', { name: /^Relatório de /, level: 1 });
  return api;
};

describe('Relatório ao cliente (admin) - detalhe do rascunho', () => {
  it('mostra carregando (status) e depois título, badge, datas e o formulário preenchido', async () => {
    const api = servidorRelatorios([rascunho()]);
    server.use(...api.handlers);
    renderApp(rotaDetalhe('r1'), 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatório…');
    expect(await screen.findByRole('heading', { name: 'Relatório de Outubro de 2026', level: 1 })).toBeInTheDocument();
    expect(within(main()).getByText('Rascunho', { selector: 'span, div' })).toBeInTheDocument();
    expect(main()).toHaveTextContent('Criado em 18/10/2026 · atualizado em 20/10/2026');
    expect(main()).not.toHaveTextContent('publicado em');
    expect(mesInput()).toHaveValue('2026-10');
    expect(conteudoInput()).toHaveValue(TEXTO);
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir rascunho' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Relatórios/ })).toBeInTheDocument();
  });

  it('a prévia "Como o cliente vê" acompanha o que se edita', async () => {
    await abrirRascunho();

    fireEvent.change(conteudoInput(), { target: { value: '<i>novo</i> texto' } });

    const previa = screen.getByRole('region', { name: 'Como o cliente vê' });
    expect(within(previa).getByText('<i>novo</i> texto')).toBeInTheDocument();
    expect(previa.querySelector('i')).toBeNull();
  });

  it('salvar: PUT só com competência (dia 1) e conteúdo sem aparar, aviso e título atualizados', async () => {
    const api = await abrirRascunho();
    const novoTexto = '  Texto revisado.\n\nOutra linha.  \n';

    fireEvent.change(mesInput(), { target: { value: '2026-11' } });
    fireEvent.change(conteudoInput(), { target: { value: novoTexto } });
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Rascunho atualizado.')).toBeInTheDocument();
    expect(api.chamadas.editar).toEqual([
      { id: 'r1', auth: `Bearer ${TOKEN}`, body: { competencia: '2026-11-01', conteudo: novoTexto } },
    ]);
    expect(await screen.findByRole('heading', { name: 'Relatório de Novembro de 2026', level: 1 })).toBeInTheDocument();
    expect(conteudoInput().value).toBe(novoTexto);
    // Continua rascunho: o cliente não vê nada novo.
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
  });

  it('depois de salvar, a lista e o histórico são relidos', async () => {
    const api = await abrirRascunho();
    await screen.findByText('Nenhuma alteração registrada.');

    fireEvent.change(conteudoInput(), { target: { value: 'Novo texto' } });
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText('Rascunho atualizado.');

    await waitFor(() => expect(api.chamadas.historicos).toEqual(['r1', 'r1']));
  });

  it('salvar com conteúdo vazio: erro do campo e nenhum PUT', async () => {
    const api = await abrirRascunho();

    fireEvent.change(conteudoInput(), { target: { value: '' } });
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Escreva o conteúdo do relatório.')).toBeInTheDocument();
    expect(api.chamadas.editar).toHaveLength(0);
  });

  it('salvar com mês de outro relatório (409) mostra o erro no campo da competência', async () => {
    const api = await abrirRascunho([rascunho(), publicado('r2', { competencia: '2026-09-01' })]);

    fireEvent.change(mesInput(), { target: { value: '2026-09' } });
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    const erro = 'Já existe um relatório desta obra para este mês. Escolha outro mês ou edite o existente.';
    expect(await screen.findByText(erro)).toBeInTheDocument();
    expect(mesInput()).toHaveAccessibleDescription(erro);
    expect(api.chamadas.editar).toHaveLength(1);
    expect(screen.queryByText('Rascunho atualizado.')).not.toBeInTheDocument();
  });

  it('salvar quando o servidor responde 500 mostra o código de suporte e mantém o texto', async () => {
    const api = servidorRelatorios([rascunho()]);
    server.use(
      http.put(`${API}/relatorios-mensais/r1`, () =>
        HttpResponse.json({ requestId: 'req-put', message: 'Erro interno' }, { status: 500 }),
      ),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');
    await screen.findByLabelText('Conteúdo');

    fireEvent.change(conteudoInput(), { target: { value: 'Meu texto novo' } });
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText(/req-put/)).toBeInTheDocument();
    expect(conteudoInput()).toHaveValue('Meu texto novo');
  });

  describe('publicar', () => {
    it('pede confirmação com o texto exato e o foco em "Cancelar"; cancelar não chama a API', async () => {
      const api = await abrirRascunho();
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Publicar' }));

      const pergunta = screen.getByText(PUBLICAR_PERGUNTA);
      const faixa = pergunta.closest('[role="alert"]') as HTMLElement;
      expect(faixa).toHaveTextContent(
        '“Outubro de 2026”. Será publicada a versão salva; o cliente da obra passa a ver este relatório.',
      );
      expect(within(faixa).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
      expect(within(faixa).getByRole('button', { name: 'Publicar agora' })).toBeEnabled();

      await u.click(within(faixa).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByText(PUBLICAR_PERGUNTA)).not.toBeInTheDocument();
      expect(api.chamadas.publicar).toHaveLength(0);
      expect(conteudoInput()).toBeInTheDocument();
    });

    it('"Publicar agora": POST sem corpo, aviso de sucesso e a tela vira somente leitura', async () => {
      const api = await abrirRascunho();
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Publicar' }));
      await u.click(screen.getByRole('button', { name: 'Publicar agora' }));

      expect(await screen.findByText('Relatório publicado. O cliente já pode vê-lo.')).toBeInTheDocument();
      expect(api.chamadas.publicar).toEqual([{ id: 'r1', auth: `Bearer ${TOKEN}` }]);
      expect(screen.queryByText(PUBLICAR_PERGUNTA)).not.toBeInTheDocument();
      expect(await screen.findByText(/Relatório publicado: somente leitura/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(Publicar|Excluir rascunho|Salvar alterações)/ })).toBeNull();
      expect(main()).toHaveTextContent('Publicado em 21/10/2026');
    });

    it('409 (já publicado em outra aba): mensagem da tela e a página relê o servidor', async () => {
      const api = servidorRelatorios([rascunho()]);
      server.use(...api.handlers);
      renderApp(rotaDetalhe('r1'), 'Admin');
      await screen.findByLabelText('Conteúdo');
      const u = user();

      // Outra aba publica antes: o servidor já tem "published", a tela ainda mostra rascunho.
      Object.assign(api.relatorios()[0] as object, { status: 'published', publishedAt: '2026-10-21T09:00:00Z' });
      await u.click(screen.getByRole('button', { name: 'Publicar' }));
      await u.click(screen.getByRole('button', { name: 'Publicar agora' }));

      expect(await screen.findByText('Este relatório já foi publicado. A página foi atualizada.')).toBeInTheDocument();
      expect(screen.queryByText('Relatório publicado. O cliente já pode vê-lo.')).not.toBeInTheDocument();
      expect(await screen.findByText(/Relatório publicado: somente leitura/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
    });

    it('500 mostra o código de suporte, fecha a confirmação e continua rascunho', async () => {
      const api = servidorRelatorios([rascunho()]);
      server.use(
        http.post(`${API}/relatorios-mensais/r1/publish`, () =>
          HttpResponse.json({ requestId: 'req-pub', message: 'Erro interno' }, { status: 500 }),
        ),
        ...api.handlers,
      );
      renderApp(rotaDetalhe('r1'), 'Admin');
      await screen.findByLabelText('Conteúdo');
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Publicar' }));
      await u.click(screen.getByRole('button', { name: 'Publicar agora' }));

      expect(await screen.findByText(/req-pub/)).toBeInTheDocument();
      expect(screen.queryByText(PUBLICAR_PERGUNTA)).not.toBeInTheDocument();
      expect(screen.queryByText('Relatório publicado. O cliente já pode vê-lo.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    });

    it('clique duplo em "Publicar agora" publica uma vez só', async () => {
      const api = servidorRelatorios([rascunho()]);
      server.use(...api.handlers);
      renderApp(rotaDetalhe('r1'), 'Admin');
      await screen.findByLabelText('Conteúdo');
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Publicar' }));
      const agora = screen.getByRole('button', { name: 'Publicar agora' });
      await u.dblClick(agora);

      await screen.findByText('Relatório publicado. O cliente já pode vê-lo.');
      expect(api.chamadas.publicar).toHaveLength(1);
    });
  });

  describe('excluir', () => {
    it('pede confirmação com o texto exato e o foco em "Cancelar"', async () => {
      const api = await abrirRascunho();
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));

      const faixa = screen.getByText(EXCLUIR_PERGUNTA).closest('[role="alert"]') as HTMLElement;
      expect(faixa).toHaveTextContent('“Outubro de 2026”. Não dá para desfazer.');
      expect(within(faixa).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
      await u.click(within(faixa).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByText(EXCLUIR_PERGUNTA)).not.toBeInTheDocument();
      expect(api.chamadas.excluir).toHaveLength(0);
    });

    it('confirmar: DELETE, volta para a lista sem rascunho e sem piscar "não encontrado"', async () => {
      const api = servidorRelatorios([rascunho(), publicado('r2', { competencia: '2026-09-01' })]);
      server.use(...api.handlers);
      renderApp(rotaDetalhe('r1'), 'Admin');
      await screen.findByLabelText('Conteúdo');
      const u = user();

      // Observa a tela durante toda a exclusão: o erro do detalhe apagado nunca pode aparecer.
      const intrusos: string[] = [];
      const observador = new MutationObserver(() => {
        const texto = document.body.textContent ?? '';
        if (/Não encontrado|Não foi possível carregar o relatório|Relatório não encontrado/.test(texto)) {
          intrusos.push(texto);
        }
      });
      observador.observe(document.body, { childList: true, subtree: true, characterData: true });

      await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
      await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

      expect(await screen.findByRole('table')).toBeInTheDocument();
      await esperar(150);
      observador.disconnect();
      expect(screen.getByRole('heading', { name: 'Relatório ao cliente', level: 1 })).toBeInTheDocument();
      expect(api.chamadas.excluir).toEqual([{ id: 'r1', auth: `Bearer ${TOKEN}` }]);
      expect(screen.queryByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Abrir relatório de Setembro de 2026' })).toBeInTheDocument();
      expect(intrusos).toEqual([]);
      // Nenhuma releitura do detalhe/histórico apagado depois do DELETE.
      const depois = api.chamadas.ordem.slice(api.chamadas.ordem.indexOf('DELETE r1') + 1);
      expect(depois.filter((c) => /detalhe r1|historico r1/.test(c))).toEqual([]);
    });

    it('409 ao excluir (publicado em outra aba) avisa e a página passa a somente leitura', async () => {
      const api = servidorRelatorios([rascunho()]);
      server.use(...api.handlers);
      renderApp(rotaDetalhe('r1'), 'Admin');
      await screen.findByLabelText('Conteúdo');
      const u = user();

      Object.assign(api.relatorios()[0] as object, { status: 'published', publishedAt: '2026-10-21T09:00:00Z' });
      await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
      await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

      expect(
        await screen.findByText('Este relatório já foi publicado e não pode ser excluído. A página foi atualizada.'),
      ).toBeInTheDocument();
      expect(await screen.findByText(/Relatório publicado: somente leitura/)).toBeInTheDocument();
      expect(screen.queryByText(EXCLUIR_PERGUNTA)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Excluir rascunho' })).not.toBeInTheDocument();
    });

    it('500 ao excluir mostra o código de suporte e fica na página', async () => {
      const api = servidorRelatorios([rascunho()]);
      server.use(
        http.delete(`${API}/relatorios-mensais/r1`, () =>
          HttpResponse.json({ requestId: 'req-del', message: 'Erro interno' }, { status: 500 }),
        ),
        ...api.handlers,
      );
      renderApp(rotaDetalhe('r1'), 'Admin');
      await screen.findByLabelText('Conteúdo');
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
      await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

      expect(await screen.findByText(/req-del/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Relatório de Outubro de 2026', level: 1 })).toBeInTheDocument();
    });

    it('abrir "Publicar" fecha a confirmação de excluir e vice-versa (só uma por vez)', async () => {
      await abrirRascunho();
      const u = user();

      await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
      await u.click(screen.getByRole('button', { name: 'Publicar' }));
      expect(screen.getByText(PUBLICAR_PERGUNTA)).toBeInTheDocument();
      expect(screen.queryByText(EXCLUIR_PERGUNTA)).not.toBeInTheDocument();

      await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
      expect(screen.getByText(EXCLUIR_PERGUNTA)).toBeInTheDocument();
      expect(screen.queryByText(PUBLICAR_PERGUNTA)).not.toBeInTheDocument();
    });
  });
});

describe('Relatório ao cliente (admin) - detalhe do publicado', () => {
  const abrirPublicado = async (historicos = {}) => {
    const api = servidorRelatorios([publicado('r2', { competencia: '2026-09-01', conteudo: TEXTO })], { historicos });
    server.use(...api.handlers);
    renderApp(rotaDetalhe('r2'), 'Admin');
    await screen.findByRole('heading', { name: 'Relatório de Setembro de 2026', level: 1 });
    return api;
  };

  it('mostra o aviso de somente leitura e o texto como o cliente vê, sem nenhum campo editável', async () => {
    await abrirPublicado();

    expect(
      screen.getByText('Relatório publicado: somente leitura. O cliente já o vê e não é possível editar nem excluir.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Competência (mês)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Publicar|Excluir|Salvar)/ })).not.toBeInTheDocument();
    const previa = screen.getByRole('region', { name: 'Como o cliente vê' });
    expect(previa.textContent).toContain(TEXTO);
    expect(within(previa).getByText('Publicado em 02/10/2026')).toBeInTheDocument();
    expect(main()).toHaveTextContent('publicado em 02/10/2026');
  });

  it('o texto do publicado também é só texto (HTML não é interpretado)', async () => {
    const api = servidorRelatorios([publicado('r2', { conteudo: '<script>alert(1)</script><b>x</b>' })]);
    server.use(...api.handlers);
    renderApp(rotaDetalhe('r2'), 'Admin');

    const previa = await screen.findByRole('region', { name: 'Como o cliente vê' });
    expect(within(previa).getByText('<script>alert(1)</script><b>x</b>')).toBeInTheDocument();
    expect(previa.querySelector('script, b')).toBeNull();
  });
});

describe('Relatório ao cliente (admin) - histórico de alterações', () => {
  it('lista as ações em português, o autor e os campos alterados, sem códigos técnicos', async () => {
    await abrirRascunho(undefined, {
      r1: [
        registro('relatorio_mensal_publicado', { createdAt: '2026-10-21T15:00:00' }),
        registro('relatorio_mensal_editado', { createdAt: '2026-10-20T14:30:00', campos: ['competencia', 'conteudo'] }),
        registro('relatorio_mensal_editado', { createdAt: '2026-10-19T10:05:00', campos: ['conteudo'] }),
        registro('relatorio_mensal_criado', { createdAt: '2026-10-18T12:00:00', userName: null, userId: null }),
      ],
    });

    expect(await screen.findByRole('heading', { name: 'Histórico de alterações' })).toBeInTheDocument();
    const lista = await screen.findByRole('list', { name: 'Alterações do relatório' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(4);
    expect(itens[0]).toHaveTextContent('21/10/2026 15:00');
    expect(itens[0]).toHaveTextContent('Relatório publicado');
    expect(itens[0]).toHaveTextContent('por Ana Admin');
    expect(itens[1]).toHaveTextContent('Relatório editado');
    expect(itens[1]).toHaveTextContent('alterou: Competência e Conteúdo');
    expect(itens[1]).toHaveTextContent('20/10/2026 14:30');
    expect(itens[2]).toHaveTextContent('19/10/2026 10:05');
    expect(itens[2]).toHaveTextContent('alterou: Conteúdo');
    expect(itens[2]).not.toHaveTextContent('Competência');
    expect(itens[3]).toHaveTextContent('Relatório criado');
    expect(itens[3]).toHaveTextContent('por Usuário removido');
    expect(itens[3]).not.toHaveTextContent('alterou');
    expect(lista.textContent).not.toMatch(/relatorio_mensal_/);
  });

  it('ação desconhecida vira texto genérico, sem expor o código', async () => {
    await abrirRascunho(undefined, { r1: [registro('relatorio_mensal_arquivado')] });

    const lista = await screen.findByRole('list', { name: 'Alterações do relatório' });
    expect(lista).toHaveTextContent('Alteração no relatório');
    expect(lista.textContent).not.toContain('arquivado');
  });

  it('sem registros: "Nenhuma alteração registrada."', async () => {
    await abrirRascunho();

    expect(await screen.findByText('Nenhuma alteração registrada.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Alterações do relatório' })).not.toBeInTheDocument();
  });

  it('mostra carregando do histórico (status) enquanto ele chega', async () => {
    const api = servidorRelatorios([rascunho()]);
    server.use(
      http.get(`${API}/relatorios-mensais/r1/historico`, async () => {
        await esperar(80);
        return undefined;
      }),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');

    await screen.findByLabelText('Conteúdo');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando histórico…');
    expect(await screen.findByText('Nenhuma alteração registrada.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /Carregando/ })).not.toBeInTheDocument();
  });

  it('100 registros (o máximo do backend) aparecem todos, em lista com rolagem', async () => {
    const muitos = Array.from({ length: 100 }, (_, i) =>
      registro('relatorio_mensal_editado', {
        createdAt: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T10:00:00`,
        campos: ['conteudo'],
      }),
    );
    await abrirRascunho(undefined, { r1: muitos });

    const lista = await screen.findByRole('list', { name: 'Alterações do relatório' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(100);
  });

  it('nunca mostra texto anterior nem o id do autor, mesmo que o servidor mande campos a mais', async () => {
    const comExtras = {
      ...registro('relatorio_mensal_editado', { campos: ['conteudo'] }),
      conteudoAnterior: 'TEXTO ANTIGO CONFIDENCIAL',
      valorAnterior: 'VALOR ANTIGO',
      createdByUserId: AUTOR_ID,
    };
    await abrirRascunho(undefined, { r1: [comExtras] });

    await screen.findByRole('list', { name: 'Alterações do relatório' });
    expect(document.body.textContent).not.toMatch(/ANTIGO|createdByUserId/);
    expect(document.body.textContent).not.toContain(AUTOR_ID);
  });

  it('erro 500 do histórico não derruba o relatório: mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    const api = servidorRelatorios([rascunho()], { historicos: { r1: [registro('relatorio_mensal_criado')] } });
    let chamadas = 0;
    server.use(
      http.get(`${API}/relatorios-mensais/r1/historico`, () => {
        chamadas += 1;
        return chamadas === 1
          ? HttpResponse.json({ requestId: 'req-hist', message: 'Erro interno' }, { status: 500 })
          : undefined;
      }),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');

    // O relatório e o formulário seguem inteiros.
    expect(await screen.findByLabelText('Conteúdo')).toHaveValue(TEXTO);
    expect(await screen.findByText(/req-hist/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Relatório de Outubro de 2026', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled();

    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('list', { name: 'Alterações do relatório' })).toBeInTheDocument();
    expect(screen.queryByText(/req-hist/)).not.toBeInTheDocument();
  });

  it('histórico com 403 ou falha de rede não derruba o relatório', async () => {
    const api = servidorRelatorios([rascunho()]);
    server.use(
      http.get(`${API}/relatorios-mensais/r1/historico`, () => HttpResponse.error()),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');

    expect(await screen.findByLabelText('Conteúdo')).toBeInTheDocument();
    expect(await screen.findByText('Não foi possível conectar ao servidor.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Relatório de Outubro de 2026', level: 1 })).toBeInTheDocument();
  });

  it('falha do histórico não gera loop: uma única chamada, sem skeleton preso e sem releituras', async () => {
    const api = servidorRelatorios([rascunho()]);
    let historicos = 0;
    server.use(
      http.get(`${API}/relatorios-mensais/r1/historico`, () => {
        historicos += 1;
        return HttpResponse.json({ requestId: 'req-loop', message: 'Erro interno' }, { status: 500 });
      }),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');

    await screen.findByText(/req-loop/);
    await esperar(300);
    expect(historicos).toBe(1);
    expect(api.chamadas.detalhes).toEqual(['r1']);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Conteúdo')).toBeInTheDocument();
  });

  it('salvar com o histórico em erro continua funcionando (falha secundária isolada)', async () => {
    const api = servidorRelatorios([rascunho()]);
    server.use(
      http.get(`${API}/relatorios-mensais/r1/historico`, () =>
        HttpResponse.json({ requestId: 'req-h', message: 'Erro' }, { status: 500 }),
      ),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');
    await screen.findByText(/req-h/);

    fireEvent.change(conteudoInput(), { target: { value: 'Texto salvo mesmo assim' } });
    await user().click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Rascunho atualizado.')).toBeInTheDocument();
    expect(api.chamadas.editar).toHaveLength(1);
  });
});

describe('Relatório ao cliente (admin) - erros do detalhe', () => {
  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    const api = servidorRelatorios([rascunho()]);
    let chamadas = 0;
    server.use(
      http.get(`${API}/relatorios-mensais/r1`, () => {
        chamadas += 1;
        return chamadas === 1
          ? HttpResponse.json({ requestId: 'req-det', message: 'Erro interno' }, { status: 500 })
          : undefined;
      }),
      ...api.handlers,
    );
    renderApp(rotaDetalhe('r1'), 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-det');
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'Relatório de Outubro de 2026', level: 1 })).toBeInTheDocument();
  });

  it('403 mostra "sem permissão", sem formulário nem ações', async () => {
    server.use(http.get(`${API}/relatorios-mensais/r1`, () => HttpResponse.json({}, { status: 403 })));
    renderApp(rotaDetalhe('r1'), 'Admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
    expect(screen.queryByRole('button', { name: /^(Publicar|Excluir)/ })).not.toBeInTheDocument();
  });

  it('404 mostra "Não encontrado." e o link de volta à lista', async () => {
    server.use(http.get(`${API}/relatorios-mensais/r1`, () => HttpResponse.json({}, { status: 404 })));
    renderApp(rotaDetalhe('r1'), 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('Não encontrado.');
    expect(screen.getByRole('link', { name: /Relatórios/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
  });

  it('relatório de OUTRA obra na URL: "Relatório não encontrado nesta obra." sem formulário, ações nem histórico', async () => {
    const api = servidorRelatorios([relatorio('rx', { obraId: OUTRA_OBRA_ID, conteudo: 'Segredo de outra obra' })]);
    server.use(...api.handlers);
    renderApp(rotaDetalhe('rx'), 'Admin');

    expect(await screen.findByText('Relatório não encontrado nesta obra.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Segredo de outra obra');
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Publicar|Excluir|Salvar)/ })).not.toBeInTheDocument();
    expect(api.chamadas.historicos).toHaveLength(0);
  });
});
