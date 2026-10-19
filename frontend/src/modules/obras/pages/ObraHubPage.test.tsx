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
});
