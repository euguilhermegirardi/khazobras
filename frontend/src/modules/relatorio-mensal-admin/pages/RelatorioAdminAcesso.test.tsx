import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthContext';
import { useRelatoriosMensais } from '@/hooks/useRelatoriosMensais';
import { saveSession } from '@/services/session';
import { AppRoutes } from '@/routes/AppRoutes';
import { fakeSession, renderApp } from '@/test/helpers';
import {
  OBRA_ID,
  publicado,
  relatorio,
  ROTA_CLIENTE,
  ROTA_LISTA,
  ROTA_NOVO,
  rotaDetalhe,
  servidorRelatorios,
} from '@/test/relatorioAdmin';
import { server } from '@/test/server';

const user = () => userEvent.setup();

const ROTAS_ADMIN = [
  ['a lista', ROTA_LISTA],
  ['o novo', ROTA_NOVO],
  ['o detalhe', rotaDetalhe('r1')],
] as const;

describe('Relatório ao cliente (admin) - papéis', () => {
  it.each(ROTAS_ADMIN)('cliente em %s: "Sem permissão" e nenhuma chamada à API', async (_nome, rota) => {
    const api = servidorRelatorios([relatorio('r1')]);
    server.use(...api.handlers);
    renderApp(rota, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /criar|novo|editar|excluir|publicar|salvar/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '+ Novo relatório' })).not.toBeInTheDocument();
    expect(api.chamadas.ordem).toEqual([]);
  });

  it.each(ROTAS_ADMIN)('deslogado em %s: vai para o login e nenhuma chamada à API', async (_nome, rota) => {
    const api = servidorRelatorios([relatorio('r1')]);
    server.use(...api.handlers);
    renderApp(rota);

    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Conteúdo')).not.toBeInTheDocument();
    expect(api.chamadas.ordem).toEqual([]);
  });

  it('Master também usa a tela', async () => {
    const api = servidorRelatorios([relatorio('r1')]);
    server.use(...api.handlers);
    renderApp(ROTA_LISTA, 'Master');

    expect(await screen.findByRole('heading', { name: 'Relatório ao cliente', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('o cliente só lê na tela dele: relatório publicado, sem botões de escrita, pedindo só os publicados', async () => {
    const api = servidorRelatorios([publicado('r2')]);
    server.use(...api.handlers);
    renderApp(ROTA_CLIENTE, 'Client');

    await screen.findByText(/Texto do relatório r2/);
    expect(
      screen.queryByRole('button', { name: /criar|novo|editar|excluir|publicar|salvar/i }),
    ).not.toBeInTheDocument();
    expect(api.chamadas.listas).toEqual(['true']);
  });
});

describe('Relatório ao cliente (admin) - menu', () => {
  const itensDoMenu = () =>
    within(screen.getByRole('navigation', { name: 'Navegação principal' }))
      .getAllByRole('link')
      .map((a) => a.textContent);

  it('admin vê "Relatório ao cliente" logo depois de "Projetos", apontando para a lista da obra', async () => {
    server.use(...servidorRelatorios([]).handlers);
    renderApp(ROTA_LISTA, 'Admin');
    await screen.findByText('Nenhum relatório ao cliente');

    const itens = itensDoMenu();
    expect(itens.indexOf('Relatório ao cliente')).toBe(itens.indexOf('Projetos') + 1);
    expect(screen.getByRole('link', { name: 'Relatório ao cliente' })).toHaveAttribute('href', ROTA_LISTA);
  });

  it('cliente não vê o item "Relatório ao cliente" (só "Relatório mensal")', async () => {
    server.use(...servidorRelatorios([publicado('r2')]).handlers);
    renderApp(ROTA_CLIENTE, 'Client');
    await screen.findByText(/Texto do relatório r2/);

    const itens = itensDoMenu();
    expect(itens).not.toContain('Relatório ao cliente');
    expect(itens).toContain('Relatório mensal');
  });

  it('o item do menu leva à lista a partir de outra tela da obra', async () => {
    server.use(...servidorRelatorios([relatorio('r1')]).handlers);
    renderApp(ROTA_NOVO, 'Admin');
    await screen.findByLabelText('Conteúdo');

    await user().click(screen.getByRole('link', { name: 'Relatório ao cliente' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

/** Mostra os meses que o CLIENTE vê, lidos pelo mesmo hook da tela dele, no mesmo cache da tela do admin. */
const VisaoDoCliente = () => {
  const { data } = useRelatoriosMensais(OBRA_ID);
  return (
    <ul aria-label="Publicados para o cliente">
      {(data ?? []).map((r) => (
        <li key={r.id}>{r.competencia}</li>
      ))}
    </ul>
  );
};

describe('Relatório ao cliente (admin) - cache da visão do cliente', () => {
  it('depois de publicar, a lista do cliente (onlyPublished=true) é relida e passa a mostrar o relatório', async () => {
    const api = servidorRelatorios([relatorio('r1', { competencia: '2026-10-01' })]);
    server.use(...api.handlers);
    saveSession(fakeSession('Admin'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[rotaDetalhe('r1')]}>
          <AuthProvider>
            <AppRoutes />
            <VisaoDoCliente />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByLabelText('Conteúdo');
    const painel = () => screen.getByRole('list', { name: 'Publicados para o cliente' });
    await waitFor(() => expect(api.chamadas.listas).toContain('true'));
    expect(within(painel()).queryAllByRole('listitem')).toHaveLength(0);
    const antes = api.chamadas.listas.filter((v) => v === 'true').length;

    const u = user();
    await u.click(screen.getByRole('button', { name: 'Publicar' }));
    await u.click(screen.getByRole('button', { name: 'Publicar agora' }));
    await screen.findByText('Relatório publicado. O cliente já pode vê-lo.');

    await waitFor(() => expect(within(painel()).getAllByRole('listitem')).toHaveLength(1));
    expect(within(painel()).getByText('2026-10-01')).toBeInTheDocument();
    expect(api.chamadas.listas.filter((v) => v === 'true').length).toBeGreaterThan(antes);
  });

  it('excluir também invalida o cache do cliente (lista do cliente relida)', async () => {
    const api = servidorRelatorios([relatorio('r1', { competencia: '2026-10-01' })]);
    server.use(...api.handlers);
    saveSession(fakeSession('Admin'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[rotaDetalhe('r1')]}>
          <AuthProvider>
            <AppRoutes />
            <VisaoDoCliente />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByLabelText('Conteúdo');
    await waitFor(() => expect(api.chamadas.listas).toContain('true'));
    const leituras = () => api.chamadas.listas.filter((v) => v === 'true').length;
    const inicio = leituras();

    // Excluir o rascunho relê a lista do cliente (ela está montada).
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
    await u.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    await screen.findByText('Nenhum relatório ao cliente');

    await waitFor(() => expect(leituras()).toBeGreaterThan(inicio));
  });
});
