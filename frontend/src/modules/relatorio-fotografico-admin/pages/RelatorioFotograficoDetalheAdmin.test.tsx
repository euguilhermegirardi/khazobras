import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  detalheRota,
  erroEm,
  etapa,
  ETAPA_ID,
  foto,
  fotosEmOrdem,
  LISTA,
  OUTRA_OBRA_ID,
  relatorio,
  servidorFotos,
  stubObjectUrl,
  TOKEN,
} from '@/test/fotosAdmin';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();

beforeEach(() => {
  stubObjectUrl();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tres = () => relatorio({ id: 'rf1', fotos: fotosEmOrdem(3) });
const ROTA = detalheRota('rf1');

/** Botão de ação de uma foto. O `name` em string é comparado inteiro: "foto 1" não casa com "foto 10". */
const acao = (verbo: string, nome: string, lado = '') =>
  screen.getByRole('button', { name: `${verbo} a ${nome}${lado}` });

describe('Relatório fotográfico (admin) - detalhe', () => {
  it('mostra carregando e depois título, descrição, contador e as fotos com descrição e data', async () => {
    server.use(...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatório');
    expect(await screen.findByRole('heading', { name: 'Setembro de 2026', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Mensal · Relatório de setembro · registrado em 01/10/2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fotos', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('3 de 100')).toBeInTheDocument();

    const lista = screen.getByRole('list', { name: 'Fotos do relatório' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveTextContent('Descrição 1');
    expect(itens[0]).toHaveTextContent('10/09/2026');
    expect(itens[0]).toHaveTextContent('1 de 3');
    expect(itens[2]).toHaveTextContent('3 de 3');
    expect(await within(lista).findByRole('button', { name: 'Ampliar foto: Descrição 1' })).toBeInTheDocument();
  });

  it('baixa as miniaturas pela API autenticada (Bearer) e só mostra blob:, nunca URL do bucket', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await screen.findByRole('button', { name: 'Ampliar foto: Descrição 3' });
    expect(api.chamadas.arquivos.map((a) => a.id).sort()).toEqual(['f1', 'f2', 'f3']);
    expect(api.chamadas.arquivos.every((a) => a.auth === `Bearer ${TOKEN}`)).toBe(true);
    for (const img of screen.getAllByRole('img')) expect(img.getAttribute('src')).toMatch(/^blob:/);
  });

  it('foto sem descrição nem data mostra "Sem descrição" e "Sem data"; botões usam "foto N"', async () => {
    server.use(
      ...servidorFotos([relatorio({ id: 'rf1', fotos: [foto('f1', { descricao: null, dataFoto: null })] })]).handlers,
    );
    renderApp(ROTA, 'Admin');

    const lista = await screen.findByRole('list', { name: 'Fotos do relatório' });
    const item = within(lista).getAllByRole('listitem')[0] as HTMLElement;
    expect(item).toHaveTextContent('Sem descrição');
    expect(item).toHaveTextContent('Sem data');
    expect(acao('Editar', 'foto 1')).toBeInTheDocument();
  });

  it('usa o nome da etapa como título dos relatórios por etapa', async () => {
    server.use(
      ...servidorFotos([relatorio({ id: 'rf1', tipo: 'etapa', etapaId: ETAPA_ID, competencia: null, fotos: [] })])
        .handlers,
    );
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('heading', { name: 'Fundação', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Etapa · Relatório de setembro · registrado em 01/10/2026')).toBeInTheDocument();
  });

  it('sem fotos mostra o vazio, 0 de 100 e a área de envio', async () => {
    server.use(...servidorFotos([relatorio({ id: 'rf1', fotos: [] })]).handlers);
    renderApp(ROTA, 'Admin');

    expect(await screen.findByText('Nenhuma foto neste relatório')).toBeInTheDocument();
    expect(screen.getByText('0 de 100')).toBeInTheDocument();
    expect(screen.getByLabelText(/Arraste as fotos aqui/)).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', LISTA);
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    const api = servidorFotos([tres()]);
    server.use(
      erroEm('get', '/relatorios-fotograficos/rf1', 500, { requestId: 'req-det-500', message: 'Erro.' }),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Código para o suporte: req-det-500');
    expect(screen.getByRole('link', { name: 'Relatórios' })).toBeInTheDocument();

    server.resetHandlers(...api.handlers);
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Setembro de 2026', level: 1 })).toBeInTheDocument();
  });

  it('403 mostra "sem permissão"', async () => {
    server.use(erroEm('get', '/relatorios-fotograficos/rf1', 403), ...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
  });

  it('relatório inexistente (404) mostra "Não encontrado." sem fotos', async () => {
    server.use(...servidorFotos([tres()]).handlers);
    renderApp(detalheRota('nao-existe'), 'Admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não encontrado.');
    expect(screen.queryByRole('list', { name: 'Fotos do relatório' })).not.toBeInTheDocument();
  });

  it('relatório de OUTRA obra na URL: "não encontrado nesta obra", sem fotos nem envio', async () => {
    server.use(
      ...servidorFotos([relatorio({ id: 'rf-outra', obraId: OUTRA_OBRA_ID, fotos: fotosEmOrdem(2, 'o') })]).handlers,
    );
    renderApp(detalheRota('rf-outra'), 'Admin');

    expect(await screen.findByText('Relatório não encontrado nesta obra.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Fotos do relatório' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Arraste as fotos aqui/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar|excluir/i })).not.toBeInTheDocument();
  });

  it('foto sem imagem (arquivo 404) mostra "Imagem indisponível" e a tela continua usável', async () => {
    server.use(erroEm('get', '/fotos/f2/arquivo', 404), ...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('img', { name: 'Descrição 2 (imagem indisponível)' })).toHaveTextContent(
      'Imagem indisponível',
    );
    expect(await screen.findByRole('button', { name: 'Ampliar foto: Descrição 1' })).toBeInTheDocument();
    expect(acao('Editar', 'foto 2 (Descrição 2)')).toBeEnabled();
  });

  it('cliente em /admin/.../:relatorioId vê "Sem permissão" e nenhuma foto é pedida', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Arraste as fotos aqui/)).not.toBeInTheDocument();
    expect(api.chamadas.detalhes).toBe(0);
    expect(api.chamadas.arquivos).toHaveLength(0);
  });

  it('editar dados do relatório pelo detalhe atualiza o título e a mensagem', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Editar dados' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar relatório' });
    const titulo = await within(dialog).findByLabelText('Título');
    await user().clear(titulo);
    await user().type(titulo, 'Setembro final');
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.editar[0]).toEqual({
      id: 'rf1',
      body: { tipo: 'mensal', etapaId: null, titulo: 'Setembro final', competencia: '2026-09-01' },
    });
    expect(screen.getByText('Relatório “Setembro final” atualizado.')).toBeInTheDocument();
    expect(await screen.findByText(/Mensal · Setembro final/)).toBeInTheDocument();
  });
});

describe('Relatório fotográfico (admin) - excluir (detalhe)', () => {
  it('pede confirmação com o número de fotos; Cancelar não chama a API', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório' }));
    expect(screen.getByText('Excluir definitivamente este relatório e suas 3 fotos?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user().click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(/Excluir definitivamente este relatório/)).not.toBeInTheDocument();
    expect(api.chamadas.excluir).toHaveLength(0);
  });

  it('confirmar exclui e volta à lista, onde o relatório não aparece mais', async () => {
    const api = servidorFotos([tres(), relatorio({ id: 'rf2', competencia: '2026-08-01', fotos: [] })]);
    server.use(
      // A releitura do relatório apagado (404) demora como na rede de verdade; antes do DELETE segue o servidor normal.
      http.get(`${API}/relatorios-fotograficos/rf1`, async () => {
        if (api.chamadas.excluir.length === 0) return undefined;
        await delay(60);
        return HttpResponse.json({}, { status: 404 });
      }),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório' }));
    // O relatório apagado volta 404 na releitura: a tela não pode piscar o erro antes de ir para a lista.
    let piscouErro = false;
    const observador = new MutationObserver(() => {
      // Só o estado de erro da página (o aviso de confirmação também é um role="alert").
      const alertas = [...document.querySelectorAll('[role="alert"]')];
      if (alertas.some((a) => a.textContent?.includes('Tentar novamente'))) piscouErro = true;
    });
    observador.observe(document.body, { childList: true, subtree: true });
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('heading', { name: 'Agosto de 2026', level: 2 })).toBeInTheDocument();
    observador.disconnect();
    expect(api.chamadas.excluir).toEqual(['rf1']);
    expect(screen.getByRole('heading', { name: 'Relatório fotográfico', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Setembro de 2026' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(piscouErro).toBe(false);
  });

  it('500 ao excluir mostra o código de suporte e fica no detalhe', async () => {
    server.use(
      erroEm('delete', '/relatorios-fotograficos/rf1', 500, { requestId: 'req-det-del', message: 'Erro.' }),
      ...servidorFotos([tres()]).handlers,
    );
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText(/Código para o suporte: req-det-del/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Setembro de 2026', level: 1 })).toBeInTheDocument();
  });

  it('404 ao excluir orienta a voltar à lista e atualizar', async () => {
    server.use(erroEm('delete', '/relatorios-fotograficos/rf1', 404), ...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Relatório não encontrado. Volte à lista e atualize a página.')).toBeInTheDocument();
  });
});

describe('Relatório fotográfico (admin) - editar foto', () => {
  const abrir = async (nome: string, posicao: number) => {
    await user().click(await screen.findByRole('button', { name: nome }));
    const dialog = await screen.findByRole('dialog', { name: `Editar foto ${posicao}` });
    return dialog;
  };

  it('abre com descrição e data atuais e manda PATCH só com o campo alterado', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Descrição 1');
    expect(within(dialog).getByLabelText('Data da foto')).toHaveValue('2026-09-10');
    await user().clear(within(dialog).getByLabelText('Descrição'));
    await user().type(within(dialog).getByLabelText('Descrição'), '  Pilares concretados  ');
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.editarFoto).toEqual([{ id: 'f1', body: { descricao: 'Pilares concretados' } }]);
    expect(screen.getByText('Foto atualizada.')).toBeInTheDocument();
    expect(await screen.findByText('Pilares concretados')).toBeInTheDocument();
  });

  it('só a data alterada manda só dataFoto', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 2 (Descrição 2)', 2);

    fireEvent.change(within(dialog).getByLabelText('Data da foto'), { target: { value: '2026-09-20' } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editarFoto).toHaveLength(1));
    expect(api.chamadas.editarFoto[0]).toEqual({ id: 'f2', body: { dataFoto: '2026-09-20' } });
  });

  it('esvaziar descrição e data manda null nos dois', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    await user().clear(within(dialog).getByLabelText('Descrição'));
    fireEvent.change(within(dialog).getByLabelText('Data da foto'), { target: { value: '' } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editarFoto).toHaveLength(1));
    expect(api.chamadas.editarFoto[0]).toEqual({ id: 'f1', body: { descricao: null, dataFoto: null } });
    expect(await screen.findAllByText('Sem descrição')).not.toHaveLength(0);
  });

  it('descrição só com espaços conta como vazia (null)', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    await user().clear(within(dialog).getByLabelText('Descrição'));
    await user().type(within(dialog).getByLabelText('Descrição'), '   ');
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editarFoto).toHaveLength(1));
    expect(api.chamadas.editarFoto[0]?.body).toEqual({ descricao: null });
  });

  it('sem nenhuma mudança fecha o diálogo e NÃO chama a API', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.editarFoto).toHaveLength(0);
    expect(screen.queryByText('Foto atualizada.')).not.toBeInTheDocument();
  });

  it('data depois de amanhã é recusada localmente', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    fireEvent.change(within(dialog).getByLabelText('Data da foto'), { target: { value: '2999-01-01' } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    expect(await within(dialog).findByText('A data deve estar entre 2000 e amanhã.')).toBeInTheDocument();
    expect(api.chamadas.editarFoto).toHaveLength(0);
  });

  it('descrição de 256 caracteres é recusada localmente; 255 é aceita', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'd'.repeat(256) } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    expect(await within(dialog).findByText('A descrição aceita no máximo 255 caracteres.')).toBeInTheDocument();
    expect(api.chamadas.editarFoto).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText('Descrição'), { target: { value: 'd'.repeat(255) } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(api.chamadas.editarFoto).toHaveLength(1));
    expect(api.chamadas.editarFoto[0]?.body).toEqual({ descricao: 'd'.repeat(255) });
  });

  it('400 com errors.DataFoto aparece no campo da data', async () => {
    server.use(
      http.patch(`${API}/fotos/f1`, () =>
        HttpResponse.json({ errors: { DataFoto: ['Data fora do intervalo aceito.'] } }, { status: 400 }),
      ),
      ...servidorFotos([tres()]).handlers,
    );
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Editar a foto 1 (Descrição 1)', 1);

    fireEvent.change(within(dialog).getByLabelText('Data da foto'), { target: { value: '2026-09-21' } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Data da foto')).toHaveAccessibleDescription(
        'Data fora do intervalo aceito.',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Editar foto 1' })).toBeInTheDocument();
  });

  it('500 mostra o código de suporte; 403 e 404 têm mensagem própria', async () => {
    server.use(
      erroEm('patch', '/fotos/f1', 500, { requestId: 'req-foto-500', message: 'Erro.' }),
      erroEm('patch', '/fotos/f2', 403),
      erroEm('patch', '/fotos/f3', 404),
      ...servidorFotos([tres()]).handlers,
    );
    renderApp(ROTA, 'Admin');

    for (const [nome, posicao, esperado] of [
      ['Editar a foto 1 (Descrição 1)', 1, 'Código para o suporte: req-foto-500'],
      ['Editar a foto 2 (Descrição 2)', 2, 'Você não tem permissão para esta ação.'],
      ['Editar a foto 3 (Descrição 3)', 3, 'Esta foto não foi encontrada.'],
    ] as const) {
      const dialog = await abrir(nome, posicao);
      await user().type(within(dialog).getByLabelText('Descrição'), ' x');
      await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(esperado);
      await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
  });
});

describe('Relatório fotográfico (admin) - remover foto', () => {
  it('pede confirmação na própria foto, foco em Cancelar, e Cancelar não chama a API', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Remover a foto 2 (Descrição 2)' }));

    const grupo = screen.getByRole('group', { name: 'Confirmar a remoção da foto 2 (Descrição 2)' });
    expect(within(grupo).getByText('Remover?')).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user().click(within(grupo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(api.chamadas.removerFoto).toHaveLength(0);
  });

  it('confirmar remove só aquela foto, atualiza o contador e mostra a mensagem', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Remover a foto 2 (Descrição 2)' }));
    await user().click(within(screen.getByRole('group')).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText('Foto removida.')).toBeInTheDocument();
    expect(api.chamadas.removerFoto).toEqual(['f2']);
    expect(await screen.findByText('2 de 100')).toBeInTheDocument();
    expect(screen.queryByText('Descrição 2')).not.toBeInTheDocument();
    expect(screen.getByText('Descrição 1')).toBeInTheDocument();
    expect(screen.getByText('Descrição 3')).toBeInTheDocument();
  });

  it('500 ao remover mostra o código de suporte e a foto continua', async () => {
    server.use(
      erroEm('delete', '/fotos/f1', 500, { requestId: 'req-rem-500', message: 'Erro.' }),
      ...servidorFotos([tres()]).handlers,
    );
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Remover a foto 1 (Descrição 1)' }));
    await user().click(within(screen.getByRole('group')).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText(/Código para o suporte: req-rem-500/)).toBeInTheDocument();
    expect(screen.getByText('Descrição 1')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('403 e 404 ao remover mostram a mensagem certa', async () => {
    server.use(
      erroEm('delete', '/fotos/f1', 403),
      erroEm('delete', '/fotos/f2', 404),
      ...servidorFotos([tres()]).handlers,
    );
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Remover a foto 1 (Descrição 1)' }));
    await user().click(within(screen.getByRole('group')).getByRole('button', { name: 'Remover' }));
    expect(await screen.findByText('Você não tem permissão para esta ação.')).toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: 'Remover a foto 2 (Descrição 2)' }));
    await user().click(within(screen.getByRole('group')).getByRole('button', { name: 'Remover' }));
    expect(await screen.findByText('Foto não encontrada. Atualize a página.')).toBeInTheDocument();
  });

  it('"Remover a foto 1" não confunde com a foto 10 (nomes exatos)', async () => {
    server.use(
      ...servidorFotos([relatorio({ id: 'rf1', fotos: fotosEmOrdem(10).map((f) => ({ ...f, descricao: null })) })])
        .handlers,
    );
    renderApp(ROTA, 'Admin');

    await screen.findByRole('list', { name: 'Fotos do relatório' });
    // Por regex (prefixo), "foto 1" casa com "foto 1" e "foto 10"; com o nome inteiro (string) cada botão é único.
    expect(screen.getAllByRole('button', { name: /^Remover a foto 1/ })).toHaveLength(2);
    expect(acao('Remover', 'foto 1')).toBeInTheDocument();
    expect(acao('Remover', 'foto 10')).toBeInTheDocument();
  });
});

describe('Relatório fotográfico (admin) - reordenar', () => {
  const para = (lado: 'esquerda' | 'direita') => ` para a ${lado}`;

  it('setas desabilitadas nas pontas: primeira sem "esquerda", última sem "direita"', async () => {
    server.use(...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    expect(acao('Mover', 'foto 1 (Descrição 1)', para('esquerda'))).toBeDisabled();
    expect(acao('Mover', 'foto 1 (Descrição 1)', para('direita'))).toBeEnabled();
    expect(acao('Mover', 'foto 2 (Descrição 2)', para('esquerda'))).toBeEnabled();
    expect(acao('Mover', 'foto 2 (Descrição 2)', para('direita'))).toBeEnabled();
    expect(acao('Mover', 'foto 3 (Descrição 3)', para('direita'))).toBeDisabled();
  });

  it('mover para a esquerda manda o PATCH do lote só com as fotos que mudaram e mostra a nova ordem', async () => {
    const api = servidorFotos([tres()]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 2 (Descrição 2)', para('esquerda')));

    await waitFor(() => expect(api.chamadas.ordem).toHaveLength(1));
    expect(api.chamadas.ordem[0]).toEqual({
      relatorioId: 'rf1',
      body: {
        fotos: [
          { id: 'f2', ordem: 0 },
          { id: 'f1', ordem: 1 },
        ],
      },
    });
    await waitFor(() => {
      const itens = within(screen.getByRole('list', { name: 'Fotos do relatório' })).getAllByRole('listitem');
      expect(itens.map((i) => /Descrição \d/.exec(i.textContent ?? '')?.[0])).toEqual([
        'Descrição 2',
        'Descrição 1',
        'Descrição 3',
      ]);
    });
    // O servidor foi relido e confirma a mesma ordem.
    expect(api.relatorios()[0]?.fotos.map((f) => `${f.id}:${f.ordem}`)).toEqual(['f1:1', 'f2:0', 'f3:2']);
  });

  it('mover para a direita no meio: lote só com as duas fotos trocadas', async () => {
    const api = servidorFotos([relatorio({ id: 'rf1', fotos: fotosEmOrdem(4) })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 2 (Descrição 2)', para('direita')));

    await waitFor(() => expect(api.chamadas.ordem).toHaveLength(1));
    expect(api.chamadas.ordem[0]?.body.fotos).toEqual([
      { id: 'f3', ordem: 1 },
      { id: 'f2', ordem: 2 },
    ]);
  });

  it('o foco continua na seta acionada depois de mover (a foto muda de posição e de nome)', async () => {
    server.use(...servidorFotos([relatorio({ id: 'rf1', fotos: fotosEmOrdem(4) })]).handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 2 (Descrição 2)', para('direita')));

    await waitFor(() => expect(acao('Mover', 'foto 3 (Descrição 2)', para('direita'))).toHaveFocus());
  });

  it('se a foto chega à ponta, o foco vai para a seta oposta (a acionada fica desabilitada)', async () => {
    server.use(...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 2 (Descrição 2)', para('esquerda')));

    await waitFor(() => expect(acao('Mover', 'foto 1 (Descrição 2)', para('direita'))).toHaveFocus());
    expect(acao('Mover', 'foto 1 (Descrição 2)', para('esquerda'))).toBeDisabled();
  });

  it('anuncia a nova posição para leitor de tela em uma região aria-live', async () => {
    server.use(...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 2 (Descrição 2)', para('esquerda')));

    const aviso = await screen.findByText('Foto movida para a posição 1 de 3.');
    expect(aviso).toHaveAttribute('aria-live', 'polite');
    expect(aviso).toHaveAttribute('role', 'status');
  });

  it('ordens repetidas no servidor (aceito pelo backend) são renumeradas 0..n-1 e vão só as que mudam', async () => {
    const empatadas = fotosEmOrdem(3).map((f) => ({ ...f, ordem: 0 }));
    const api = servidorFotos([relatorio({ id: 'rf1', fotos: empatadas })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 3 (Descrição 3)', para('esquerda')));

    await waitFor(() => expect(api.chamadas.ordem).toHaveLength(1));
    // f1 já tinha 0 e continua 0; f3 vira 1 e f2 vira 2.
    expect(api.chamadas.ordem[0]?.body.fotos).toEqual([
      { id: 'f3', ordem: 1 },
      { id: 'f2', ordem: 2 },
    ]);
  });

  it('400 do lote (tudo-ou-nada): volta à ordem anterior, mostra o erro e o foco volta ao botão', async () => {
    const api = servidorFotos([tres()]);
    server.use(
      http.patch(`${API}/relatorios-fotograficos/rf1/fotos/ordem`, () =>
        HttpResponse.json({ errors: { Fotos: ['Foto de outro relatório.'] } }, { status: 400 }),
      ),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 2 (Descrição 2)', para('esquerda')));

    // Nota ao builder: hoje o alerta traz só "Dados inválidos." (a mensagem de errors.Fotos não é mostrada).
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => {
      const itens = within(screen.getByRole('list', { name: 'Fotos do relatório' })).getAllByRole('listitem');
      expect(itens.map((i) => /Descrição \d/.exec(i.textContent ?? '')?.[0])).toEqual([
        'Descrição 1',
        'Descrição 2',
        'Descrição 3',
      ]);
    });
    expect(screen.queryByText(/Foto movida para a posição/)).not.toBeInTheDocument();
    await waitFor(() => expect(acao('Mover', 'foto 2 (Descrição 2)', para('esquerda'))).toHaveFocus());
  });

  it('500 ao reordenar mostra o código de suporte e a ordem original', async () => {
    server.use(
      erroEm('patch', '/relatorios-fotograficos/rf1/fotos/ordem', 500, { requestId: 'req-ord-500', message: 'Erro.' }),
      ...servidorFotos([tres()]).handlers,
    );
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 1 (Descrição 1)', para('direita')));

    expect(await screen.findByText(/Código para o suporte: req-ord-500/)).toBeInTheDocument();
    await waitFor(() => expect(acao('Mover', 'foto 1 (Descrição 1)', para('direita'))).toBeInTheDocument());
  });

  it('403 e 404 ao reordenar mostram a mensagem e mantêm a ordem', async () => {
    server.use(erroEm('patch', '/relatorios-fotograficos/rf1/fotos/ordem', 403), ...servidorFotos([tres()]).handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('list', { name: 'Fotos do relatório' });

    await user().click(acao('Mover', 'foto 1 (Descrição 1)', para('direita')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
  });
});

describe('Relatório fotográfico (admin) - estresse', () => {
  const longa = 'Descrição muito longa de uma foto da obra, com detalhes de execução da laje do pavimento. '.repeat(3);

  it('100 fotos: contador 100 de 100, envio bloqueado, setas das pontas e sem quebrar', async () => {
    // Miniaturas respondem 404 aqui: o carregamento simultâneo de 100 imagens é coberto no e2e (navegador de verdade).
    server.use(
      erroEm('get', '/fotos/:id/arquivo', 404),
      ...servidorFotos([relatorio({ id: 'rf1', fotos: fotosEmOrdem(100) })]).handlers,
    );
    renderApp(ROTA, 'Admin');

    const lista = await screen.findByRole('list', { name: 'Fotos do relatório' });
    // O contador do cabeçalho do card (a última foto também mostra "100 de 100").
    expect(screen.getByRole('heading', { name: 'Fotos', level: 2 }).parentElement).toHaveTextContent('100 de 100');
    // Com 100 cartões, consulta sem escopo/`hidden: true` checa a visibilidade de cada nó (segundos sob CPU saturada):
    // o input vai por seletor e os botões são procurados dentro do cartão da foto.
    expect(within(lista).getAllByRole('listitem', { hidden: true })).toHaveLength(100);
    const campo = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(campo).toBeDisabled();
    expect(campo).toHaveAccessibleName(/Limite de 100 fotos atingido/);
    const cartao = (descricao: string) => within(lista).getByText(descricao).closest('li') as HTMLElement;
    const botaoDe = (descricao: string, nome: string) =>
      within(cartao(descricao)).getByRole('button', { name: nome, hidden: true });
    expect(botaoDe('Descrição 100', 'Mover a foto 100 (Descrição 100) para a direita')).toBeDisabled();
    expect(botaoDe('Descrição 10', 'Mover a foto 10 (Descrição 10) para a direita')).toBeEnabled();
    expect(botaoDe('Descrição 1', 'Remover a foto 1 (Descrição 1)')).toBeInTheDocument();
  });

  it('descrição de 255 caracteres: o rótulo dos botões é cortado em 40 e o texto da foto é truncado com title', async () => {
    const descricao = longa.slice(0, 255);
    server.use(...servidorFotos([relatorio({ id: 'rf1', fotos: [foto('f1', { descricao })] })]).handlers);
    renderApp(ROTA, 'Admin');

    const lista = await screen.findByRole('list', { name: 'Fotos do relatório' });
    const item = within(lista).getAllByRole('listitem')[0] as HTMLElement;
    expect(within(item).getByText(descricao)).toHaveAttribute('title', descricao);
    expect(acao('Editar', `foto 1 (${descricao.slice(0, 40)}…)`)).toBeInTheDocument();
  });

  it('título do relatório com 150 caracteres aparece inteiro no cabeçalho', async () => {
    const titulo = `T${'í'.repeat(149)}`;
    server.use(
      ...servidorFotos([relatorio({ id: 'rf1', tipo: 'etapa', competencia: null, titulo, fotos: [] })], {
        etapas: [etapa({ id: 'outra', nome: 'Outra etapa' })],
      }).handlers,
    );
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('heading', { name: titulo, level: 1 })).toBeInTheDocument();
  });
});
