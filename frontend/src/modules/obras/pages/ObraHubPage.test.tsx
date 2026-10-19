import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';
import type { Obra } from '@/interfaces/obra';

const obra: Obra = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Residencial Aurora',
  endereco: 'Rua das Flores, 100',
  valorContratado: 1500000,
  dataInicio: '2026-03-01',
  dataPrevisaoTermino: '2026-12-15',
  status: 'EmAndamento',
  createdAt: '2026-02-20T12:00:00Z',
};

const page = (items: Obra[]) => ({ totalItems: items.length, pageIndex: 0, pageSize: 50, items });

describe('Hub do cliente', () => {
  it('mostra carregando e depois a obra com valor e datas em pt-BR', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([obra]))));
    renderApp('/cliente', 'Client');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando obras');
    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText(/1\.500\.000,00/)).toBeInTheDocument();
    expect(screen.getByText('01/03/2026')).toBeInTheDocument();
    expect(screen.getByText('15/12/2026')).toBeInTheDocument();
  });

  it('sem obras vinculadas mostra mensagem de vazio', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([]))));
    renderApp('/cliente', 'Client');

    expect(await screen.findByText(/Nenhuma obra vinculada/)).toBeInTheDocument();
  });

  it('erro 500 mostra o codigo de suporte e permite tentar de novo', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/obras`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-123', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json(page([obra]));
      }),
    );
    renderApp('/cliente', 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-123');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
  });

  it('clicar na obra abre a pagina da obra', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([obra]))));
    renderApp('/cliente', 'Client');

    await userEvent.setup().click(await screen.findByRole('link', { name: /Residencial Aurora/ }));

    expect(await screen.findByRole('heading', { name: /Dashboard/ })).toBeInTheDocument();
  });

  it('admin nao acessa o Hub do cliente', async () => {
    renderApp('/cliente', 'Admin');

    expect(screen.queryByText('Suas obras')).not.toBeInTheDocument();
  });

  it('cliente nao ve o titulo do hub do admin nem links para /admin', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([obra]))));
    renderApp('/cliente', 'Client');

    await screen.findByRole('heading', { name: 'Residencial Aurora' });
    expect(screen.queryByRole('heading', { name: 'Meus projetos' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Residencial Aurora/ })).toHaveAttribute(
      'href',
      `/cliente/obras/${obra.id}`,
    );
  });
});

describe('Hub do admin (Meus projetos)', () => {
  const outra: Obra = {
    ...obra,
    id: '33333333-3333-3333-3333-333333333333',
    nome: 'Edifício Horizonte',
    status: 'Concluida',
  };

  it('mostra carregando e depois todas as obras, com o título e a descrição do admin', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([obra, outra]))));
    renderApp('/admin', 'Admin');

    expect(screen.getByRole('heading', { name: 'Meus projetos' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando obras');
    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edifício Horizonte' })).toBeInTheDocument();
    expect(screen.getByText('Selecione uma obra para trabalhar.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Suas obras' })).not.toBeInTheDocument();
  });

  it('pede /obras com pageIndex=0&pageSize=50 e envia o Bearer', async () => {
    let url = '';
    let auth = '';
    server.use(
      http.get(`${API}/obras`, ({ request }) => {
        url = request.url;
        auth = request.headers.get('Authorization') ?? '';
        return HttpResponse.json(page([obra]));
      }),
    );
    renderApp('/admin', 'Admin');

    await screen.findByRole('heading', { name: 'Residencial Aurora' });
    const params = new URL(url).searchParams;
    expect(params.get('pageIndex')).toBe('0');
    expect(params.get('pageSize')).toBe('50');
    expect(auth).toMatch(/^Bearer /);
  });

  it.each(['Admin', 'Master'] as const)('%s entra e cada obra leva para /admin/obras/:id', async (role) => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([obra]))));
    renderApp('/admin', role);

    expect(await screen.findByRole('link', { name: /Residencial Aurora/ })).toHaveAttribute(
      'href',
      `/admin/obras/${obra.id}`,
    );
  });

  it('sem obras mostra a mensagem de vazio do admin', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([]))));
    renderApp('/admin', 'Admin');

    expect(await screen.findByText('Nenhuma obra cadastrada ainda.')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma obra vinculada/)).not.toBeInTheDocument();
  });

  it('erro 500 mostra o codigo de suporte e permite tentar de novo', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/obras`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-hub-admin', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json(page([obra]));
      }),
    );
    renderApp('/admin', 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-hub-admin');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
  });

  it('403 mostra a mensagem de permissao', async () => {
    server.use(http.get(`${API}/obras`, () => new HttpResponse(null, { status: 403 })));
    renderApp('/admin', 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
  });

  it('clicar na obra abre a pagina da obra no admin, com o item "Gantt editavel" na sidebar', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json(page([obra]))));
    renderApp('/admin', 'Admin');

    await userEvent.setup().click(await screen.findByRole('link', { name: /Residencial Aurora/ }));

    expect(await screen.findByRole('heading', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gantt editável' })).toHaveAttribute(
      'href',
      `/admin/obras/${obra.id}/gantt`,
    );
  });

  it('cliente nao entra no hub do admin e nao dispara a busca de obras', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/obras`, () => {
        calls += 1;
        return HttpResponse.json(page([obra]));
      }),
    );
    renderApp('/admin', 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Meus projetos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Residencial Aurora/ })).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('deslogado vai para o login', async () => {
    renderApp('/admin');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  describe('paginacao', () => {
    it('com totalItems <= pageSize nao mostra a paginacao', async () => {
      server.use(
        http.get(`${API}/obras`, () =>
          HttpResponse.json({ totalItems: 50, pageIndex: 0, pageSize: 50, items: [obra] }),
        ),
      );
      renderApp('/admin', 'Admin');

      await screen.findByRole('heading', { name: 'Residencial Aurora' });
      expect(screen.queryByRole('navigation', { name: 'Paginação das obras' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Próxima' })).not.toBeInTheDocument();
    });

    it('com mais de uma pagina mostra "Pagina X de Y" e navega pedindo o pageIndex certo', async () => {
      const pedidos: string[] = [];
      server.use(
        http.get(`${API}/obras`, ({ request }) => {
          const pageIndex = Number(new URL(request.url).searchParams.get('pageIndex'));
          pedidos.push(String(pageIndex));
          const item = pageIndex === 0 ? obra : outra;
          return HttpResponse.json({ totalItems: 120, pageIndex, pageSize: 50, items: [item] });
        }),
      );
      const u = userEvent.setup();
      renderApp('/admin', 'Admin');

      const nav = await screen.findByRole('navigation', { name: 'Paginação das obras' });
      expect(nav).toHaveTextContent('120 obras');
      expect(nav).toHaveTextContent('Página 1 de 3');
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

      await u.click(screen.getByRole('button', { name: 'Próxima' }));
      expect(await screen.findByRole('heading', { name: 'Edifício Horizonte' })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Paginação das obras' })).toHaveTextContent('Página 2 de 3');
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();

      await u.click(screen.getByRole('button', { name: 'Anterior' }));
      expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
      expect(pedidos.slice(0, 2)).toEqual(['0', '1']);
    });

    it('na ultima pagina "Proxima" fica desabilitada', async () => {
      server.use(
        http.get(`${API}/obras`, ({ request }) => {
          const pageIndex = Number(new URL(request.url).searchParams.get('pageIndex'));
          return HttpResponse.json({
            totalItems: 51,
            pageIndex,
            pageSize: 50,
            items: [pageIndex === 0 ? obra : outra],
          });
        }),
      );
      const u = userEvent.setup();
      renderApp('/admin', 'Admin');

      await u.click(await screen.findByRole('button', { name: 'Próxima' }));
      await screen.findByRole('heading', { name: 'Edifício Horizonte' });
      expect(screen.getByRole('navigation', { name: 'Paginação das obras' })).toHaveTextContent('Página 2 de 2');
      expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    });
  });
});
