import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  OBRA_ID,
  publicado,
  relatorio,
  ROTA_LISTA,
  ROTA_NOVO,
  rotaDetalhe,
  servidorRelatorios,
  TOKEN,
} from '@/test/relatorioAdmin';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();
const main = () => screen.getByRole('main');
const linhaDe = (titulo: string) =>
  within(main())
    .getByRole('link', { name: `Abrir relatório de ${titulo}` })
    .closest('tr') as HTMLElement;

const tresRelatorios = () => [
  relatorio('r1', { competencia: '2026-10-01', conteudo: 'Rascunho de outubro.\nSegunda linha.' }),
  publicado('r2', {
    competencia: '2026-09-01',
    conteudo: '<b>Setembro</b> publicado',
    publishedAt: '2026-10-02T12:00:00Z',
  }),
  publicado('r3', { competencia: '2026-08-01', conteudo: 'Agosto publicado', publishedAt: '2026-09-03T12:00:00Z' }),
];

describe('Relatório ao cliente (admin) - lista', () => {
  it('mostra carregando (status acessível) e depois o título e as colunas', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatórios…');
    await screen.findByRole('table');
    expect(screen.getByRole('heading', { name: 'Relatório ao cliente', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Competência', 'Resumo', 'Status', 'Publicado em', 'Atualizado em', 'Ações']);
  });

  it('lê TODOS os relatórios (onlyPublished=false) com o token e ordena do mês mais novo ao mais antigo', async () => {
    const api = servidorRelatorios([
      publicado('r3', { competencia: '2026-08-01' }),
      relatorio('r1', { competencia: '2026-10-01' }),
      publicado('r2', { competencia: '2026-09-01' }),
    ]);
    let auth = '';
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, ({ request }) => {
        auth = request.headers.get('Authorization') ?? '';
        return undefined;
      }),
      ...api.handlers,
    );
    renderApp(ROTA_LISTA, 'Admin');

    await screen.findByRole('table');
    expect(api.chamadas.listas).toEqual(['false']);
    expect(auth).toBe(`Bearer ${TOKEN}`);
    const meses = within(screen.getByRole('table'))
      .getAllByRole('link', { name: /^Abrir relatório de / })
      .map((a) => a.textContent);
    expect(meses).toEqual(['Outubro de 2026', 'Setembro de 2026', 'Agosto de 2026']);
  });

  it('cada linha mostra competência (link), resumo, status, datas e as ações certas por status', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');

    const rascunho = linhaDe('Outubro de 2026');
    expect(within(rascunho).getByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).toHaveAttribute(
      'href',
      rotaDetalhe('r1'),
    );
    expect(within(rascunho).getByText('Rascunho')).toBeInTheDocument();
    // Resumo em uma linha só (quebra vira espaço).
    expect(within(rascunho).getByText('Rascunho de outubro. Segunda linha.')).toBeInTheDocument();
    // Rascunho: ainda não publicado ("—"); atualizado em 20/10/2026.
    expect(within(rascunho).getByText('—')).toBeInTheDocument();
    expect(within(rascunho).getByText('20/10/2026')).toBeInTheDocument();
    expect(within(rascunho).getByRole('link', { name: 'Editar relatório de Outubro de 2026' })).toHaveAttribute(
      'href',
      rotaDetalhe('r1'),
    );
    expect(within(rascunho).getByRole('button', { name: 'Excluir relatório de Outubro de 2026' })).toBeEnabled();
    expect(within(rascunho).queryByRole('link', { name: /^Ver relatório/ })).not.toBeInTheDocument();

    const publicadoLinha = linhaDe('Setembro de 2026');
    expect(within(publicadoLinha).getByText('Publicado')).toBeInTheDocument();
    expect(within(publicadoLinha).getByText('02/10/2026')).toBeInTheDocument();
    expect(within(publicadoLinha).getByRole('link', { name: 'Ver relatório de Setembro de 2026' })).toHaveAttribute(
      'href',
      rotaDetalhe('r2'),
    );
    // Publicado só abre: nada de Editar nem Excluir.
    expect(within(publicadoLinha).queryByRole('link', { name: /^Editar relatório/ })).not.toBeInTheDocument();
    expect(within(publicadoLinha).queryByRole('button', { name: /^Excluir relatório/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Excluir relatório de / })).toHaveLength(1);
  });

  it('o resumo é texto (HTML não é interpretado) e tem no máximo 200 caracteres', async () => {
    const api = servidorRelatorios([
      publicado('r2', { competencia: '2026-09-01', conteudo: '<b>negrito</b> <img src=x onerror=alert(1)>' }),
      relatorio('r1', { competencia: '2026-10-01', conteudo: 'x'.repeat(5000) }),
    ]);
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');

    expect(within(main()).getByText('<b>negrito</b> <img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(main().querySelector('b, img')).toBeNull();
    expect(within(linhaDe('Outubro de 2026')).getByTitle('x'.repeat(200))).toBeInTheDocument();
  });

  it('tem o botão "+ Novo relatório" apontando para a tela de criação', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');

    expect(await screen.findByRole('link', { name: '+ Novo relatório' })).toHaveAttribute('href', ROTA_NOVO);
  });

  it('filtra por status e mostra a mensagem própria quando o filtro não tem nada', async () => {
    const api = servidorRelatorios([
      relatorio('r1', { competencia: '2026-10-01' }),
      relatorio('r5', { competencia: '2026-06-01' }),
    ]);
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');

    const filtro = screen.getByLabelText('Status');
    expect(
      within(filtro)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos os status', 'Rascunho', 'Publicado']);
    await user().selectOptions(filtro, 'Publicado');

    expect(screen.getByText('Nenhum relatório com este status.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // O filtro continua na tela para o admin voltar.
    await user().selectOptions(screen.getByLabelText('Status'), 'Rascunho');
    expect(within(screen.getByRole('table')).getAllByRole('link', { name: /^Abrir relatório de / })).toHaveLength(2);
    // Filtrar é só na tela: nenhuma chamada nova.
    expect(api.chamadas.listas).toEqual(['false']);
  });

  it('filtro "Publicado" esconde os rascunhos', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');

    await user().selectOptions(screen.getByLabelText('Status'), 'Publicado');

    expect(screen.queryByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir relatório de Setembro de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir relatório de Agosto de 2026' })).toBeInTheDocument();
  });

  it('vazio: "Nenhum relatório ao cliente", sem filtro nem tabela, mas com o botão de criar', async () => {
    const api = servidorRelatorios([]);
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');

    expect(await screen.findByText('Nenhum relatório ao cliente')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Novo relatório' })).toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    const api = servidorRelatorios(tresRelatorios());
    let chamadas = 0;
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, () => {
        chamadas += 1;
        return chamadas === 1
          ? HttpResponse.json({ requestId: 'req-500', message: 'Erro interno' }, { status: 500 })
          : undefined;
      }),
      ...api.handlers,
    );
    renderApp(ROTA_LISTA, 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-500');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro 403 mostra "sem permissão" e oferece "Tentar novamente"', async () => {
    server.use(http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, () => HttpResponse.json({}, { status: 403 })));
    renderApp(ROTA_LISTA, 'Admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('erro 404 da obra mostra mensagem útil e não a tabela', async () => {
    server.use(http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, () => HttpResponse.json({}, { status: 404 })));
    renderApp(ROTA_LISTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('Não encontrado.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('excluir rascunho: confirmação com o foco em Cancelar, DELETE e a linha some com aviso', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');
    const u = user();

    await u.click(screen.getByRole('button', { name: 'Excluir relatório de Outubro de 2026' }));
    expect(screen.getByText('Excluir definitivamente este rascunho?')).toBeInTheDocument();
    expect(screen.getByText(/“Outubro de 2026”\. Não dá para desfazer\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(api.chamadas.excluir).toHaveLength(0);

    await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Rascunho excluído.')).toBeInTheDocument();
    expect(api.chamadas.excluir).toEqual([{ id: 'r1', auth: `Bearer ${TOKEN}` }]);
    expect(screen.queryByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).not.toBeInTheDocument();
    expect(screen.queryByText('Excluir definitivamente este rascunho?')).not.toBeInTheDocument();
    // A lista foi relida do servidor.
    expect(api.chamadas.listas).toEqual(['false', 'false']);
  });

  it('cancelar a exclusão não chama a API e mantém a linha', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');
    const u = user();

    await u.click(screen.getByRole('button', { name: 'Excluir relatório de Outubro de 2026' }));
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Excluir definitivamente este rascunho?')).not.toBeInTheDocument();
    expect(api.chamadas.excluir).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).toBeInTheDocument();
  });

  it('excluir que dá 409 (publicado em outra aba) avisa e relê a lista', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(
      http.delete(`${API}/relatorios-mensais/r1`, () =>
        HttpResponse.json({ message: 'Relatorio publicado nao pode ser excluido.' }, { status: 409 }),
      ),
      ...api.handlers,
    );
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');
    const u = user();

    await u.click(screen.getByRole('button', { name: 'Excluir relatório de Outubro de 2026' }));
    await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este relatório já foi publicado e não pode ser excluído. A lista foi atualizada.',
    );
    expect(screen.queryByText('Rascunho excluído.')).not.toBeInTheDocument();
    expect(api.chamadas.listas).toEqual(['false', 'false']);
  });

  it('excluir que dá 500 mostra o código de suporte e mantém a linha', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(
      http.delete(`${API}/relatorios-mensais/r1`, () =>
        HttpResponse.json({ requestId: 'req-del', message: 'Erro interno' }, { status: 500 }),
      ),
      ...api.handlers,
    );
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');
    const u = user();

    await u.click(screen.getByRole('button', { name: 'Excluir relatório de Outubro de 2026' }));
    await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('req-del');
    expect(screen.getByRole('link', { name: 'Abrir relatório de Outubro de 2026' })).toBeInTheDocument();
  });

  it('o shell tem "Sair" e a tela não mostra createdByUserId nem o id do autor', async () => {
    const api = servidorRelatorios(tresRelatorios());
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByRole('table');

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/createdByUserId|33333333-3333/);
  });
});
