import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  erroEm,
  ETAPA_ID,
  foto,
  fotosEmOrdem,
  LISTA,
  OBRA_ID,
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

const setembro = relatorio({
  id: 'rf-set',
  titulo: 'Relatório de setembro',
  competencia: '2026-09-01',
  createdAt: '2026-10-01T12:00:00Z',
  fotos: fotosEmOrdem(3),
});
const agosto = relatorio({
  id: 'rf-ago',
  titulo: 'Relatório de agosto',
  competencia: '2026-08-01',
  createdAt: '2026-09-01T12:00:00Z',
  fotos: [foto('a1')],
});
const fundacao = relatorio({
  id: 'rf-fund',
  tipo: 'etapa',
  etapaId: ETAPA_ID,
  titulo: 'Fotos da concretagem',
  competencia: null,
  createdAt: '2026-09-15T12:00:00Z',
  fotos: fotosEmOrdem(2, 'e'),
});
const TRES = [setembro, agosto, fundacao];

const cartao = (titulo: string) => screen.getByRole('heading', { name: titulo, level: 2 });

describe('Relatório fotográfico (admin) - lista', () => {
  it('mostra carregando e depois os relatórios mensais com o título "Setembro de 2026", tipo, data e nº de fotos', async () => {
    server.use(...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatórios fotográficos');
    expect(await screen.findByRole('heading', { name: 'Relatório fotográfico', level: 1 })).toBeInTheDocument();

    const titulos = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    // Mês mais novo primeiro; o relatório por etapa fica na outra aba.
    expect(titulos).toEqual(['Setembro de 2026', 'Agosto de 2026']);
    const painel = screen.getByRole('tabpanel');
    expect(within(painel).getByText('Relatório de setembro · registrado em 01/10/2026')).toBeInTheDocument();
    expect(within(painel).getByText('3 fotos')).toBeInTheDocument();
    expect(within(painel).getByText('1 foto')).toBeInTheDocument();
    expect(within(painel).getAllByText('Mensal').length).toBeGreaterThan(0);
  });

  it('aba Etapa mostra o nome da etapa como título e o título digitado na descrição', async () => {
    server.use(...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('tab', { name: 'Etapa' }));

    const painel = await screen.findByRole('tabpanel');
    expect(within(painel).getByRole('heading', { name: 'Fundação', level: 2 })).toBeInTheDocument();
    expect(within(painel).getByText('Fotos da concretagem · registrado em 15/09/2026')).toBeInTheDocument();
    expect(within(painel).getByText('2 fotos')).toBeInTheDocument();
    expect(within(painel).queryByText('Setembro de 2026')).not.toBeInTheDocument();
  });

  it('"Gerenciar fotos" leva ao detalhe do relatório', async () => {
    server.use(...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByRole('link', { name: 'Gerenciar fotos: Setembro de 2026' })).toHaveAttribute(
      'href',
      `${LISTA}/rf-set`,
    );
  });

  it('sem relatórios mostra o vazio e mantém o botão de criar', async () => {
    server.use(...servidorFotos([]).handlers);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByText('Nenhum relatório fotográfico')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo relatório' })).toBeInTheDocument();
  });

  it('aba sem relatórios do tipo mostra a mensagem da aba', async () => {
    server.use(...servidorFotos([setembro]).handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByText('Nenhum relatório por etapa nesta obra.')).toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    const api = servidorFotos(TRES);
    server.use(
      erroEm('get', `/obras/${OBRA_ID}/relatorios-fotograficos`, 500, { requestId: 'req-lista-500', message: 'Erro.' }),
      ...api.handlers,
    );
    renderApp(LISTA, 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Código para o suporte: req-lista-500');
    expect(screen.queryByRole('button', { name: '+ Novo relatório' })).not.toBeInTheDocument();

    server.resetHandlers(...api.handlers);
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Setembro de 2026', level: 2 })).toBeInTheDocument();
  });

  it('erro 403 mostra "sem permissão" e nenhum relatório', async () => {
    server.use(erroEm('get', `/obras/${OBRA_ID}/relatorios-fotograficos`, 403), ...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
    expect(screen.queryByRole('heading', { name: 'Setembro de 2026' })).not.toBeInTheDocument();
  });

  it('falha ao carregar as etapas não derruba a tela: relatório por etapa cai no título digitado', async () => {
    server.use(
      erroEm('get', `/obras/${OBRA_ID}/etapas`, 500, { requestId: 'req-etapas', message: 'x' }),
      ...servidorFotos(TRES).handlers,
    );
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('tab', { name: 'Etapa' }));
    expect(await screen.findByRole('heading', { name: 'Fotos da concretagem', level: 2 })).toBeInTheDocument();
  });

  it('título de 150 caracteres cabe: o card mostra o texto inteiro (title) sem quebrar a tela', async () => {
    const longo = `Vistoria ${'x'.repeat(141)}`;
    expect(longo).toHaveLength(150);
    server.use(...servidorFotos([relatorio({ id: 'rf-l', tipo: 'etapa', titulo: longo, competencia: null })]).handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('tab', { name: 'Etapa' }));
    const titulo = await screen.findByRole('heading', { name: longo, level: 2 });
    expect(titulo).toHaveAttribute('title', longo);
  });
});

describe('Relatório fotográfico (admin) - papel', () => {
  it('cliente em /admin/... vê "Sem permissão" e nenhuma chamada é feita', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /novo relatório|editar|excluir/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Setembro de 2026')).not.toBeInTheDocument();
    expect(api.chamadas.listas).toBe(0);
    expect(api.chamadas.etapas).toBe(0);
  });

  it('Admin e Master acessam a lista', async () => {
    server.use(...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Master');
    expect(await screen.findByRole('heading', { name: 'Setembro de 2026', level: 2 })).toBeInTheDocument();
  });

  it('deslogado vai para o login', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(api.chamadas.listas).toBe(0);
  });
});

/** Abre o diálogo "Novo relatório" e espera o formulário (as etapas carregam antes). */
async function abrirNovo() {
  await user().click(await screen.findByRole('button', { name: '+ Novo relatório' }));
  const dialog = await screen.findByRole('dialog', { name: 'Novo relatório fotográfico' });
  await within(dialog).findByLabelText('Título');
  return dialog;
}

const mesAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
};

describe('Relatório fotográfico (admin) - criar', () => {
  it('abre com tipo Mensal, competência no mês de hoje e sem etapa', async () => {
    server.use(...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    expect(within(dialog).getByLabelText('Tipo')).toHaveValue('mensal');
    expect(within(dialog).getByLabelText('Competência')).toHaveValue(mesAtual());
    expect(within(dialog).getByLabelText('Etapa')).toHaveValue('');
    expect(within(dialog).getByLabelText('Título')).toHaveValue('');
  });

  it('cria um relatório por etapa: POST com os campos, aba Etapa aberta, mensagem e card com o nome da etapa', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().selectOptions(within(dialog).getByLabelText('Tipo'), 'etapa');
    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Fundação');
    fireEvent.change(within(dialog).getByLabelText('Competência'), { target: { value: '' } });
    await user().type(within(dialog).getByLabelText('Título'), '  Fundação concluída  ');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.criar).toEqual([
      {
        auth: `Bearer ${TOKEN}`,
        body: { obraId: OBRA_ID, tipo: 'etapa', etapaId: ETAPA_ID, titulo: 'Fundação concluída', competencia: null },
      },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Relatório “Fundação concluída” criado.');
    expect(screen.getByRole('tab', { name: 'Etapa' })).toHaveAttribute('data-state', 'active');
    const painel = await screen.findByRole('tabpanel');
    expect(await within(painel).findByText('Fundação concluída · registrado em 20/10/2026')).toBeInTheDocument();
    expect(within(painel).getByText('0 fotos')).toBeInTheDocument();
  });

  it('cria um relatório mensal: competência vira o dia 1 do mês e o card mostra "Mês de ano"', async () => {
    const api = servidorFotos([]);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    fireEvent.change(within(dialog).getByLabelText('Competência'), { target: { value: '2026-09' } });
    await user().type(within(dialog).getByLabelText('Título'), 'Setembro');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    expect(await screen.findByRole('heading', { name: 'Setembro de 2026', level: 2 })).toBeInTheDocument();
    expect(api.chamadas.criar[0]?.body).toEqual({
      obraId: OBRA_ID,
      tipo: 'mensal',
      etapaId: null,
      titulo: 'Setembro',
      competencia: '2026-09-01',
    });
  });

  it('sem título: erro no campo e nada é enviado', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    expect(await within(dialog).findByText('Informe o título do relatório.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true');
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('título com 151 caracteres é recusado localmente (limite do banco: 150)', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    fireEvent.change(within(dialog).getByLabelText('Título'), { target: { value: 'y'.repeat(151) } });
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    expect(await within(dialog).findByText('O título aceita no máximo 150 caracteres.')).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('competência com ano fora de 2000-2100 é recusada localmente', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    fireEvent.change(within(dialog).getByLabelText('Competência'), { target: { value: '1999-12' } });
    await user().type(within(dialog).getByLabelText('Título'), 'Antigo');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    expect(await within(dialog).findByText('O ano deve estar entre 2000 e 2100.')).toBeInTheDocument();
    expect(api.chamadas.criar).toHaveLength(0);
  });

  it('tipo Etapa sem etapa só sugere (não trava): o POST é enviado com etapaId null', async () => {
    const api = servidorFotos([]);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().selectOptions(within(dialog).getByLabelText('Tipo'), 'etapa');
    expect(within(dialog).getByText(/Recomendado no tipo Etapa/)).toBeInTheDocument();
    await user().type(within(dialog).getByLabelText('Título'), 'Sem etapa definida');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    await waitFor(() => expect(api.chamadas.criar).toHaveLength(1));
    expect(api.chamadas.criar[0]?.body).toMatchObject({ tipo: 'etapa', etapaId: null });
  });

  it('400 com errors.EtapaId aparece no campo Etapa e o diálogo continua aberto', async () => {
    const api = servidorFotos(TRES);
    server.use(
      http.post(`${API}/relatorios-fotograficos`, () =>
        HttpResponse.json({ errors: { EtapaId: ['A etapa informada não pertence a esta obra.'] } }, { status: 400 }),
      ),
      ...api.handlers,
    );
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Fundação');
    await user().type(within(dialog).getByLabelText('Título'), 'Qualquer');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    const campo = await within(dialog).findByLabelText('Etapa');
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'));
    expect(campo).toHaveAccessibleDescription('A etapa informada não pertence a esta obra.');
    expect(screen.getByRole('dialog', { name: 'Novo relatório fotográfico' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('400 em outro campo (Titulo) vai para o campo do título', async () => {
    server.use(
      http.post(`${API}/relatorios-fotograficos`, () =>
        HttpResponse.json({ errors: { Titulo: ['Título já usado.'] } }, { status: 400 }),
      ),
      ...servidorFotos([]).handlers,
    );
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().type(within(dialog).getByLabelText('Título'), 'Repetido');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Título')).toHaveAccessibleDescription('Título já usado.'),
    );
  });

  it('500 mostra o código de suporte no diálogo, que continua aberto com o que foi digitado', async () => {
    server.use(
      erroEm('post', '/relatorios-fotograficos', 500, { requestId: 'req-criar-500', message: 'Erro interno.' }),
      ...servidorFotos([]).handlers,
    );
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().type(within(dialog).getByLabelText('Título'), 'Meu relatório');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Código para o suporte: req-criar-500');
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Meu relatório');
    expect(within(dialog).getByRole('button', { name: 'Criar relatório' })).toBeEnabled();
  });

  it('403 mostra "sem permissão" no diálogo', async () => {
    server.use(erroEm('post', '/relatorios-fotograficos', 403), ...servidorFotos([]).handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().type(within(dialog).getByLabelText('Título'), 'X');
    await user().click(within(dialog).getByRole('button', { name: 'Criar relatório' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
  });

  it('Cancelar fecha o diálogo sem chamar a API', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirNovo();

    await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.criar).toHaveLength(0);
  });
});

describe('Relatório fotográfico (admin) - editar', () => {
  const abrirEdicao = async (nome: string) => {
    await user().click(await screen.findByRole('button', { name: nome }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar relatório' });
    await within(dialog).findByLabelText('Título');
    return dialog;
  };

  it('abre com os valores atuais e manda os quatro campos no PUT', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirEdicao('Editar relatório: Setembro de 2026');

    expect(within(dialog).getByLabelText('Tipo')).toHaveValue('mensal');
    expect(within(dialog).getByLabelText('Competência')).toHaveValue('2026-09');
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Relatório de setembro');

    await user().clear(within(dialog).getByLabelText('Título'));
    await user().type(within(dialog).getByLabelText('Título'), 'Setembro revisado');
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.editar).toEqual([
      {
        id: 'rf-set',
        body: { tipo: 'mensal', etapaId: null, titulo: 'Setembro revisado', competencia: '2026-09-01' },
      },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Relatório “Setembro revisado” atualizado.');
    expect(await screen.findByText('Setembro revisado · registrado em 01/10/2026')).toBeInTheDocument();
  });

  it('trocar para tipo Etapa e limpar a competência manda null; a lista passa para a aba Etapa', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirEdicao('Editar relatório: Agosto de 2026');

    await user().selectOptions(within(dialog).getByLabelText('Tipo'), 'etapa');
    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Fundação');
    fireEvent.change(within(dialog).getByLabelText('Competência'), { target: { value: '' } });
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]).toEqual({
      id: 'rf-ago',
      body: { tipo: 'etapa', etapaId: ETAPA_ID, titulo: 'Relatório de agosto', competencia: null },
    });
    expect(await screen.findByRole('tab', { name: 'Etapa' })).toHaveAttribute('data-state', 'active');
  });

  it('relatório com etapa: o select vem na etapa certa e "Sem etapa" limpa para null', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');
    await user().click(await screen.findByRole('tab', { name: 'Etapa' }));
    const dialog = await abrirEdicao('Editar relatório: Fundação');

    expect(within(dialog).getByLabelText('Etapa')).toHaveValue(ETAPA_ID);
    await user().selectOptions(within(dialog).getByLabelText('Etapa'), 'Sem etapa');
    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(api.chamadas.editar).toHaveLength(1));
    expect(api.chamadas.editar[0]?.body).toMatchObject({ tipo: 'etapa', etapaId: null });
  });

  it('400 com errors.EtapaId no PUT aparece no campo Etapa', async () => {
    server.use(
      http.put(`${API}/relatorios-fotograficos/rf-set`, () =>
        HttpResponse.json({ errors: { EtapaId: ['Etapa inválida.'] } }, { status: 400 }),
      ),
      ...servidorFotos(TRES).handlers,
    );
    renderApp(LISTA, 'Admin');
    const dialog = await abrirEdicao('Editar relatório: Setembro de 2026');

    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(within(dialog).getByLabelText('Etapa')).toHaveAccessibleDescription('Etapa inválida.'));
    expect(screen.getByRole('dialog', { name: 'Editar relatório' })).toBeInTheDocument();
  });

  it('500 no PUT mostra o código de suporte', async () => {
    server.use(
      erroEm('put', '/relatorios-fotograficos/rf-set', 500, { requestId: 'req-put-500', message: 'Erro.' }),
      ...servidorFotos(TRES).handlers,
    );
    renderApp(LISTA, 'Admin');
    const dialog = await abrirEdicao('Editar relatório: Setembro de 2026');

    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('req-put-500');
  });

  it('409 no PUT mostra a mensagem do servidor e mantém o diálogo', async () => {
    server.use(
      erroEm('put', '/relatorios-fotograficos/rf-set', 409, { message: 'O relatório mudou. Atualize a página.' }),
      ...servidorFotos(TRES).handlers,
    );
    renderApp(LISTA, 'Admin');
    const dialog = await abrirEdicao('Editar relatório: Setembro de 2026');

    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('O relatório mudou. Atualize a página.');
  });

  it('404 no PUT (excluído em outra aba) orienta a atualizar a página', async () => {
    server.use(erroEm('put', '/relatorios-fotograficos/rf-set', 404), ...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');
    const dialog = await abrirEdicao('Editar relatório: Setembro de 2026');

    await user().click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este relatório não foi encontrado.');
  });
});

describe('Relatório fotográfico (admin) - excluir (lista)', () => {
  it('pede confirmação com o número de fotos, foco em Cancelar, e Cancelar não chama a API', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório: Setembro de 2026' }));

    expect(screen.getByText('Excluir definitivamente este relatório e suas 3 fotos?')).toBeInTheDocument();
    expect(screen.getByText(/“Setembro de 2026”\. Não dá para desfazer\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user().click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(/Excluir definitivamente este relatório/)).not.toBeInTheDocument();
    expect(api.chamadas.excluir).toHaveLength(0);
    expect(cartao('Setembro de 2026')).toBeInTheDocument();
  });

  it('com 1 foto o texto fica no singular', async () => {
    server.use(...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório: Agosto de 2026' }));
    expect(screen.getByText('Excluir definitivamente este relatório e sua 1 foto?')).toBeInTheDocument();
  });

  it('confirmar exclui, mostra a mensagem e o card some da lista', async () => {
    const api = servidorFotos(TRES);
    server.use(...api.handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório: Setembro de 2026' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Relatório excluído.'));
    expect(api.chamadas.excluir).toEqual(['rf-set']);
    expect(screen.queryByRole('heading', { name: 'Setembro de 2026' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agosto de 2026', level: 2 })).toBeInTheDocument();
  });

  it('500 ao excluir mostra o código de suporte e o relatório continua na lista', async () => {
    server.use(
      erroEm('delete', '/relatorios-fotograficos/rf-set', 500, { requestId: 'req-del-500', message: 'Erro.' }),
      ...servidorFotos(TRES).handlers,
    );
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório: Setembro de 2026' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    // A confirmação também é um alert e fica na tela até a resposta chegar: espera o alerta de erro (estado final).
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Código para o suporte: req-del-500'));
    expect(cartao('Setembro de 2026')).toBeInTheDocument();
  });

  it('403 ao excluir mostra "sem permissão"', async () => {
    server.use(erroEm('delete', '/relatorios-fotograficos/rf-set', 403), ...servidorFotos(TRES).handlers);
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório: Setembro de 2026' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.'));
  });

  it('404 ao excluir (já excluído em outra aba) orienta a atualizar e a lista relê o servidor', async () => {
    const api = servidorFotos(TRES);
    server.use(
      http.delete(`${API}/relatorios-fotograficos/rf-set`, () => {
        api.relatorios().splice(0, api.relatorios().length, agosto, fundacao); // sumiu no servidor
        return HttpResponse.json({}, { status: 404 });
      }),
      ...api.handlers,
    );
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('button', { name: 'Excluir relatório: Setembro de 2026' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Relatório não encontrado. Atualize a página.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Setembro de 2026' })).not.toBeInTheDocument());
  });
});
