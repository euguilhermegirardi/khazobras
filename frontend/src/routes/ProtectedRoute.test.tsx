import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

describe('guarda de rotas por papel', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API}/obras`, () => HttpResponse.json({ totalItems: 0, pageIndex: 0, pageSize: 50, items: [] })),
    );
  });

  it('sem sessao, redireciona para o login', () => {
    renderApp('/cliente');
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('cliente acessa a visao cliente', () => {
    renderApp('/cliente', 'Client');
    expect(screen.getByRole('heading', { name: 'Suas obras' })).toBeInTheDocument();
  });

  it('cliente NAO acessa a area admin', () => {
    renderApp('/admin', 'Client');
    expect(screen.getByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Meus projetos' })).not.toBeInTheDocument();
  });

  it.each(['Admin', 'Master'] as const)('%s acessa a area admin', (role) => {
    renderApp('/admin', role);
    expect(screen.getByRole('heading', { name: 'Meus projetos' })).toBeInTheDocument();
  });

  it('admin NAO entra na visao cliente', () => {
    renderApp('/cliente', 'Admin');
    expect(screen.getByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
  });

  it('a raiz leva cada papel para a sua home', () => {
    renderApp('/', 'Client');
    expect(screen.getByRole('heading', { name: 'Suas obras' })).toBeInTheDocument();
  });
});
