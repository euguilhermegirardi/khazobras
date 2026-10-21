import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  documentos,
  ETAPA_ALVENARIA,
  ETAPA_FUNDACAO,
  OBRA_ID,
  projeto,
  ROTA,
  ROTA_CLIENTE,
  servidorProjetos,
  TOKEN,
} from '@/test/projetosAdmin';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();
const main = () => screen.getByRole('main');

const createObjectURL = vi.fn();
let anchorClicks: { download: string; href: string }[] = [];

beforeEach(() => {
  createObjectURL.mockReset();
  createObjectURL.mockImplementation(() => 'blob:http://localhost/proj-admin');
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  anchorClicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchorClicks.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Títulos (h2) dos cards de etapa, sem o card "Enviar documentos". */
const titulosDosGrupos = () =>
  within(main())
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent)
    .filter((t) => t !== 'Enviar documentos');

const linha = (nome: string) => screen.getByTitle(nome).closest('tr') as HTMLElement;

const tresEtapas = () => [
  projeto('p1', { etapaId: ETAPA_ALVENARIA, nome: 'alvenaria.pdf', tipoDocumento: 'Planta baixa' }),
  projeto('p2', { etapaId: ETAPA_FUNDACAO, nome: 'fundacao.pdf' }),
  projeto('p3', { etapaId: null, nome: 'memorial.docx', tipoDocumento: 'Memorial' }),
];

describe('Projetos (admin) - lista', () => {
  it('mostra carregando e depois um card por etapa, na ordem do backend, com "Sem etapa" por último', async () => {
    const api = servidorProjetos(tresEtapas());
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando projetos');
    await screen.findByRole('heading', { name: 'Fundação', level: 2 });
    expect(screen.getByRole('heading', { name: 'Projetos', level: 1 })).toBeInTheDocument();
    expect(titulosDosGrupos()).toEqual(['Fundação', 'Alvenaria', 'Sem etapa']);
  });

  it('cada tabela tem as colunas Nome, Tipo, Enviado em e Ações; mostra tipo (ou "—"), data e contagem por card', async () => {
    const api = servidorProjetos([
      projeto('p1', { nome: 'planta.pdf', tipoDocumento: 'Planta baixa', uploadedAt: '2026-03-10T15:00:00Z' }),
      projeto('p2', { nome: 'sem-tipo.pdf', tipoDocumento: null, uploadedAt: '2026-04-02T15:00:00Z' }),
    ]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await screen.findByTitle('planta.pdf');
    const tabela = screen.getByRole('table');
    expect(
      within(tabela)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Nome', 'Tipo', 'Enviado em', 'Ações']);
    expect(within(linha('planta.pdf')).getByText('Planta baixa')).toBeInTheDocument();
    expect(within(linha('planta.pdf')).getByText('10/03/2026')).toBeInTheDocument();
    expect(within(linha('sem-tipo.pdf')).getByLabelText('Sem tipo')).toHaveTextContent('—');
    expect(within(linha('sem-tipo.pdf')).getByText('02/04/2026')).toBeInTheDocument();
    expect(screen.getByText('2 documentos')).toBeInTheDocument();
  });

  it('o contador da área de envio diz "A obra tem N de 200 documentos"', async () => {
    const api = servidorProjetos(documentos(12));
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    expect(await screen.findByText(/A obra tem 12 de 200 documentos\./)).toBeInTheDocument();
  });

  it('etapas falhando: documentos de etapa caem em "Etapa não identificada", "Sem etapa" por último, sem erro na tela', async () => {
    const api = servidorProjetos([
      projeto('p1', { etapaId: ETAPA_FUNDACAO, nome: 'x.pdf' }),
      projeto('p2', { etapaId: null, nome: 'y.pdf' }),
    ]);
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/etapas`, () =>
        HttpResponse.json({ requestId: 'req-etapas', message: 'Erro' }, { status: 500 }),
      ),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    await screen.findByRole('heading', { name: 'Etapa não identificada' });
    expect(titulosDosGrupos()).toEqual(['Etapa não identificada', 'Sem etapa']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('etapa desconhecida mesmo com etapas carregadas também vai para "Etapa não identificada"', async () => {
    const api = servidorProjetos([projeto('p1', { etapaId: 'nao-existe', nome: 'x.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('heading', { name: 'Etapa não identificada' })).toBeInTheDocument();
  });

  it('vazio: "Nenhum documento enviado ainda" com a área de envio visível e habilitada', async () => {
    const api = servidorProjetos([]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    expect(await screen.findByText('Nenhum documento enviado ainda')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Arraste os documentos aqui/)).toBeEnabled();
    expect(screen.getByText(/A obra tem 0 de 200 documentos\./)).toBeInTheDocument();
  });

  it('500 na lista mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    let chamadas = 0;
    const api = servidorProjetos([projeto('p1', { nome: 'ok.pdf' })]);
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/projetos`, () => {
        chamadas += 1;
        return chamadas === 1
          ? HttpResponse.json({ requestId: 'req-lista-500', message: 'Erro interno' }, { status: 500 })
          : undefined;
      }),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('Código para o suporte: req-lista-500');
    expect(screen.queryByLabelText(/Arraste os documentos aqui/)).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByTitle('ok.pdf')).toBeInTheDocument();
  });

  it.each([
    [403, 'Você não tem permissão para esta ação.'],
    [404, 'Não encontrado.'],
  ])('%i na lista mostra a mensagem e nenhum documento nem área de envio', async (status, mensagem) => {
    const api = servidorProjetos([projeto('p1')]);
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/projetos`, () => HttpResponse.json({}, { status })),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(mensagem);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('nome e tipo com HTML aparecem como texto, nunca interpretados', async () => {
    const api = servidorProjetos([projeto('p1', { nome: '<b>negrito</b>.pdf', tipoDocumento: '<i>x</i>' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    expect(await screen.findByTitle('<b>negrito</b>.pdf')).toHaveTextContent('<b>negrito</b>.pdf');
    expect(screen.getByText('<i>x</i>')).toBeInTheDocument();
    expect(main().querySelector('b, i')).toBeNull();
  });

  it('200 documentos com nomes de 255 caracteres: todos listados, com ações pelo nome exato', async () => {
    const longo = (i: number) => `${String(i).padStart(3, '0')}-${'n'.repeat(247)}.pdf`;
    const todos = Array.from({ length: 200 }, (_, i) => projeto(`d${i}`, { nome: longo(i) }));
    expect(longo(7)).toHaveLength(255);
    const api = servidorProjetos(todos);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await screen.findByText('200 documentos');
    expect(screen.getAllByRole('row')).toHaveLength(201);
    expect(screen.getByRole('button', { name: `Excluir ${longo(199)}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Editar ${longo(0)}` })).toBeInTheDocument();
    expect(screen.getByText(/A obra tem 200 de 200 documentos\./)).toBeInTheDocument();
  }, 30_000);
});

describe('Projetos (admin) - botões por linha', () => {
  it('Visualizar só em PDF e imagem; Baixar, Editar e Excluir em todos (nome exato no aria-label)', async () => {
    const nomes = ['a.pdf', 'B.JPG', 'c.jpeg', 'd.png', 'e.webp', 'f.gif', 'g.xlsx', 'h.doc', 'i.DOCX', 'j.xls'];
    const api = servidorProjetos(nomes.map((nome, i) => projeto(`p${i}`, { nome })));
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await screen.findByTitle('a.pdf');
    for (const nome of nomes) {
      expect(screen.getByRole('button', { name: `Baixar ${nome}` })).toBeEnabled();
      expect(screen.getByRole('button', { name: `Editar ${nome}` })).toBeEnabled();
      expect(screen.getByRole('button', { name: `Excluir ${nome}` })).toBeEnabled();
      const visualizar = screen.queryByRole('button', { name: `Visualizar ${nome}` });
      if (['g.xlsx', 'h.doc', 'i.DOCX', 'j.xls'].includes(nome)) expect(visualizar).not.toBeInTheDocument();
      else expect(visualizar).toBeInTheDocument();
    }
  });

  it('Baixar usa o Bearer, salva o blob com o nome do documento e não abre URL do bucket', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'memorial.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Baixar memorial.pdf' }));

    await waitFor(() => expect(anchorClicks).toHaveLength(1));
    expect(anchorClicks[0]?.download).toBe('memorial.pdf');
    expect(anchorClicks[0]?.href).toMatch(/^blob:/);
    expect(api.chamadas.downloads).toEqual([{ id: 'p1', auth: `Bearer ${TOKEN}` }]);
  });

  it('Visualizar abre o blob em nova aba com noopener', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const api = servidorProjetos([projeto('p1', { nome: 'planta.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Visualizar planta.pdf' }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledWith('blob:http://localhost/proj-admin', '_blank', 'noopener');
    expect(api.chamadas.downloads[0]?.auth).toBe(`Bearer ${TOKEN}`);
  });

  it('download com 403 mostra a mensagem sem derrubar a lista', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' }), projeto('p2', { nome: 'b.pdf' })]);
    server.use(
      http.get(`${API}/projetos/p1/download`, () => HttpResponse.json({}, { status: 403 })),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Baixar a.pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
    expect(screen.getByTitle('b.pdf')).toBeInTheDocument();
    expect(anchorClicks).toHaveLength(0);
  });
});

describe('Projetos (admin) - editar', () => {
  const abrir = async (nome: string) => {
    await user().click(await screen.findByRole('button', { name: `Editar ${nome}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar documento' });
    await within(dialog).findByLabelText('Nome do documento');
    return dialog;
  };
  const salvar = (dialog: HTMLElement) =>
    user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

  it('abre com nome, tipo e etapa atuais e salva com os três campos; a lista e a mensagem refletem', async () => {
    const api = servidorProjetos([
      projeto('p1', { nome: 'Planta.pdf', tipoDocumento: 'Planta baixa', etapaId: ETAPA_FUNDACAO }),
    ]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Planta.pdf');

    expect(within(dialog).getByLabelText('Nome do documento')).toHaveValue('Planta.pdf');
    expect(within(dialog).getByLabelText('Tipo de documento')).toHaveValue('Planta baixa');
    expect(within(dialog).getByLabelText('Etapa')).toHaveValue(ETAPA_FUNDACAO);

    fireEvent.change(within(dialog).getByLabelText('Nome do documento'), { target: { value: '  Planta final.pdf ' } });
    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Alvenaria');
    await salvar(dialog);

    expect(await screen.findByText('Documento atualizado.')).toBeInTheDocument();
    expect(api.chamadas.editar).toEqual([
      {
        id: 'p1',
        auth: `Bearer ${TOKEN}`,
        body: { nome: 'Planta final.pdf', tipoDocumento: 'Planta baixa', etapaId: ETAPA_ALVENARIA },
      },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Alvenaria', level: 2 })).toBeInTheDocument();
    expect(screen.getByTitle('Planta final.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fundação', level: 2 })).not.toBeInTheDocument();
  });

  it('esvaziar o tipo e escolher "Sem etapa" manda null nos dois (sempre os 3 campos no PUT)', async () => {
    const api = servidorProjetos([
      projeto('p1', { nome: 'Planta.pdf', tipoDocumento: 'Planta baixa', etapaId: ETAPA_FUNDACAO }),
    ]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Planta.pdf');

    await user().clear(within(dialog).getByLabelText('Tipo de documento'));
    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Sem etapa');
    await salvar(dialog);

    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body).toEqual({ nome: 'Planta.pdf', tipoDocumento: null, etapaId: null });
    expect(Object.keys(api.chamadas.editar[0]?.body ?? {}).sort()).toEqual(['etapaId', 'nome', 'tipoDocumento']);
    expect(await screen.findByRole('heading', { name: 'Sem etapa', level: 2 })).toBeInTheDocument();
  });

  it('tipo só com espaços conta como vazio (null)', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf', tipoDocumento: 'Memorial' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    fireEvent.change(within(dialog).getByLabelText('Tipo de documento'), { target: { value: '   ' } });
    await salvar(dialog);

    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body).toEqual({ nome: 'a.pdf', tipoDocumento: null, etapaId: null });
  });

  it('o nome precisa manter a extensão, sem diferenciar maiúsculas; sem extensão ou com outra é recusado localmente', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'Planta.PDF' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('Planta.PDF');
    const nome = within(dialog).getByLabelText('Nome do documento');

    fireEvent.change(nome, { target: { value: 'Planta.txt' } });
    await salvar(dialog);
    expect(
      await within(dialog).findByText('O nome deve terminar com a extensão do arquivo (.pdf).'),
    ).toBeInTheDocument();
    expect(nome).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(nome, { target: { value: 'Planta' } });
    await salvar(dialog);
    await waitFor(() => expect(nome).toHaveAccessibleDescription(/terminar com a extensão do arquivo/));
    expect(api.chamadas.editar).toHaveLength(0);

    // Outra caixa da mesma extensão vale.
    fireEvent.change(nome, { target: { value: 'Planta nova.pdf' } });
    await salvar(dialog);
    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body.nome).toBe('Planta nova.pdf');
  });

  it('nome vazio, com barra ou acima de 255 caracteres é recusado localmente; com exatamente 255 vai', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');
    const nome = within(dialog).getByLabelText('Nome do documento');

    fireEvent.change(nome, { target: { value: '   ' } });
    await salvar(dialog);
    expect(await within(dialog).findByText('Informe o nome do documento.')).toBeInTheDocument();

    fireEvent.change(nome, { target: { value: 'pasta/a.pdf' } });
    await salvar(dialog);
    expect(await within(dialog).findByText(/não pode ter barras/)).toBeInTheDocument();

    fireEvent.change(nome, { target: { value: 'pasta\\a.pdf' } });
    await salvar(dialog);
    await waitFor(() => expect(nome).toHaveAccessibleDescription(/não pode ter barras/));

    fireEvent.change(nome, { target: { value: `${'n'.repeat(252)}.pdf` } });
    await salvar(dialog);
    await waitFor(() => expect(nome).toHaveAccessibleDescription('O nome aceita no máximo 255 caracteres.'));
    expect(api.chamadas.editar).toHaveLength(0);

    fireEvent.change(nome, { target: { value: `${'n'.repeat(251)}.pdf` } });
    await salvar(dialog);
    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
  });

  it('tipo com mais de 50 caracteres é recusado localmente', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    fireEvent.change(within(dialog).getByLabelText('Tipo de documento'), { target: { value: 't'.repeat(51) } });
    await salvar(dialog);

    expect(await within(dialog).findByText('O tipo do documento aceita no máximo 50 caracteres.')).toBeInTheDocument();
    expect(api.chamadas.editar).toHaveLength(0);
  });

  it('sem nenhuma mudança fecha o diálogo e NÃO chama a API', async () => {
    const api = servidorProjetos([
      projeto('p1', { nome: 'a.pdf', tipoDocumento: 'Memorial', etapaId: ETAPA_FUNDACAO }),
    ]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    await salvar(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.editar).toHaveLength(0);
    expect(screen.queryByText('Documento atualizado.')).not.toBeInTheDocument();
  });

  it('Cancelar fecha o diálogo sem chamar a API', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    fireEvent.change(within(dialog).getByLabelText('Nome do documento'), { target: { value: 'b.pdf' } });
    await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.editar).toHaveLength(0);
    expect(screen.getByTitle('a.pdf')).toBeInTheDocument();
  });

  it('400 com errors.Nome aparece no campo do nome e o diálogo continua aberto', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(
      http.put(`${API}/projetos/p1`, () =>
        HttpResponse.json({ errors: { Nome: ['Já existe um documento com este nome.'] } }, { status: 400 }),
      ),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    fireEvent.change(within(dialog).getByLabelText('Nome do documento'), { target: { value: 'b.pdf' } });
    await salvar(dialog);

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Nome do documento')).toHaveAccessibleDescription(
        'Já existe um documento com este nome.',
      ),
    );
    expect(within(dialog).getByLabelText('Nome do documento')).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar documento' })).toBeInTheDocument();
  });

  it('400 com errors.EtapaId aparece no campo da etapa', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(
      http.put(`${API}/projetos/p1`, () =>
        HttpResponse.json({ errors: { EtapaId: ['A etapa informada não pertence a esta obra.'] } }, { status: 400 }),
      ),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Fundação');
    await salvar(dialog);

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Etapa')).toHaveAccessibleDescription(
        'A etapa informada não pertence a esta obra.',
      ),
    );
    expect(within(dialog).getByLabelText('Etapa')).toHaveAttribute('aria-invalid', 'true');
  });

  it('500 mostra o código de suporte; 403 e 404 têm mensagem própria', async () => {
    const api = servidorProjetos([
      projeto('p1', { nome: 'a.pdf' }),
      projeto('p2', { nome: 'b.pdf' }),
      projeto('p3', { nome: 'c.pdf' }),
    ]);
    server.use(
      http.put(`${API}/projetos/p1`, () =>
        HttpResponse.json({ requestId: 'req-put-500', message: 'Erro.' }, { status: 500 }),
      ),
      http.put(`${API}/projetos/p2`, () => HttpResponse.json({}, { status: 403 })),
      http.put(`${API}/projetos/p3`, () => HttpResponse.json({}, { status: 404 })),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    for (const [nome, esperado] of [
      ['a.pdf', 'Código para o suporte: req-put-500'],
      ['b.pdf', 'Você não tem permissão para esta ação.'],
      ['c.pdf', 'Este documento não foi encontrado. Feche e atualize a página.'],
    ] as const) {
      const dialog = await abrir(nome);
      fireEvent.change(within(dialog).getByLabelText('Nome do documento'), { target: { value: `novo-${nome}` } });
      await salvar(dialog);
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(esperado);
      await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
  });

  it('etapas indisponíveis: o formulário abre só com "Sem etapa" e "Etapa atual" (não perde a etapa gravada)', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf', etapaId: ETAPA_FUNDACAO })]);
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json({}, { status: 500 })),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');
    const dialog = await abrir('a.pdf');

    const etapa = within(dialog).getByLabelText('Etapa');
    expect(
      within(etapa)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Sem etapa', 'Etapa atual']);
    expect(etapa).toHaveValue(ETAPA_FUNDACAO);
  });
});

describe('Projetos (admin) - excluir', () => {
  it('pede confirmação com o nome, foco em Cancelar, e Cancelar não chama a API', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'planta.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir planta.pdf' }));

    expect(screen.getByText('Excluir definitivamente o documento planta.pdf?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user().click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(/Excluir definitivamente o documento/)).not.toBeInTheDocument();
    expect(api.chamadas.excluir).toHaveLength(0);
    expect(screen.getByTitle('planta.pdf')).toBeInTheDocument();
  });

  it('confirmar chama DELETE só daquele documento, mostra "Documento excluído." e tira da lista', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' }), projeto('p2', { nome: 'b.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir a.pdf' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Documento excluído.')).toBeInTheDocument();
    expect(api.chamadas.excluir).toEqual([{ id: 'p1', auth: `Bearer ${TOKEN}` }]);
    await waitFor(() => expect(screen.queryByTitle('a.pdf')).not.toBeInTheDocument());
    expect(screen.getByTitle('b.pdf')).toBeInTheDocument();
    expect(screen.getByText(/A obra tem 1 de 200 documentos\./)).toBeInTheDocument();
  });

  it('excluir o último documento leva ao vazio', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir a.pdf' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Nenhum documento enviado ainda')).toBeInTheDocument();
  });

  it('500 mostra o código de suporte; 404 pede para atualizar a página; 403 tem mensagem própria; a lista continua', async () => {
    const api = servidorProjetos([
      projeto('p1', { nome: 'a.pdf' }),
      projeto('p2', { nome: 'b.pdf' }),
      projeto('p3', { nome: 'c.pdf' }),
    ]);
    server.use(
      http.delete(`${API}/projetos/p1`, () =>
        HttpResponse.json({ requestId: 'req-del-500', message: 'Erro.' }, { status: 500 }),
      ),
      http.delete(`${API}/projetos/p2`, () => HttpResponse.json({}, { status: 403 })),
      http.delete(`${API}/projetos/p3`, () => HttpResponse.json({}, { status: 404 })),
      ...api.handlers,
    );
    renderApp(ROTA, 'Admin');

    for (const [nome, esperado] of [
      ['a.pdf', 'Código para o suporte: req-del-500'],
      ['b.pdf', 'Você não tem permissão para esta ação.'],
      ['c.pdf', 'Documento não encontrado. Atualize a página.'],
    ] as const) {
      await user().click(await screen.findByRole('button', { name: `Excluir ${nome}` }));
      await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
      expect(await screen.findByText(esperado)).toBeInTheDocument();
      expect(screen.queryByText('Documento excluído.')).not.toBeInTheDocument();
      expect(screen.getByTitle(nome)).toBeInTheDocument();
    }
  });
});

describe('Projetos (admin) - papel e navegação', () => {
  it('master também acessa a tela', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Master');

    expect(await screen.findByTitle('a.pdf')).toBeInTheDocument();
  });

  it('cliente é barrado em /admin/.../projetos: "Sem permissão", sem ações de admin e sem chamar a API', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' })]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Enviar documentos' })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /editar|excluir|enviar/i })).not.toBeInTheDocument();
    expect(api.chamadas.listas).toBe(0);
    expect(api.chamadas.uploads).toHaveLength(0);
  });

  it('deslogado é enviado ao login', async () => {
    renderApp(ROTA);
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('"Projetos" aparece na sidebar do admin, ativo na rota', async () => {
    const api = servidorProjetos([projeto('p1')]);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await screen.findByRole('heading', { name: 'Projetos', level: 1 });
    const link = within(screen.getByRole('navigation')).getByRole('link', { name: 'Projetos' });
    expect(link).toHaveAttribute('href', ROTA);
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('o cliente (módulo Projetos) vê o documento que o admin enviou, editou e excluiu (mesma lista do servidor)', async () => {
    const api = servidorProjetos([projeto('p1', { nome: 'a.pdf' }), projeto('p2', { nome: 'b.pdf' })]);
    server.use(...api.handlers);
    const admin = renderApp(ROTA, 'Admin');
    const u = user();

    // Admin renomeia a.pdf e exclui b.pdf.
    await u.click(await screen.findByRole('button', { name: 'Editar a.pdf' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar documento' });
    fireEvent.change(await within(dialog).findByLabelText('Nome do documento'), {
      target: { value: 'a-revisada.pdf' },
    });
    await u.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText('Documento atualizado.');
    await u.click(screen.getByRole('button', { name: 'Excluir b.pdf' }));
    await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    await screen.findByText('Documento excluído.');
    admin.unmount();

    renderApp(ROTA_CLIENTE, 'Client');

    expect(await screen.findByText('a-revisada.pdf')).toBeInTheDocument();
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar|excluir|enviar/i })).not.toBeInTheDocument();
  });
});
