import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  it('valida campos obrigatorios sem chamar a API', async () => {
    renderApp('/login');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
  });

  it('credenciais erradas mostram mensagem clara', async () => {
    server.use(http.post(`${API}/auth/login`, () => new HttpResponse(null, { status: 401 })));
    renderApp('/login');

    await fillAndSubmit('a@example.com', 'errada');

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
  });

  it('login de cliente leva ao Hub e guarda a sessao', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          token: 'tok',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          userId: 'u1',
          name: 'Cliente',
          email: 'c@example.com',
          role: 'Client',
        }),
      ),
      http.get(`${API}/obras`, () => HttpResponse.json({ totalItems: 0, pageIndex: 0, pageSize: 50, items: [] })),
    );
    renderApp('/login');

    await fillAndSubmit('c@example.com', 'qualquer');

    expect(await screen.findByRole('heading', { name: 'Suas obras' })).toBeInTheDocument();
    expect(sessionStorage.getItem('khazobras.session')).toContain('"role":"Client"');
  });

  it('erro 500 mostra o codigo de suporte', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ requestId: 'req-9', message: 'Erro interno.' }, { status: 500 }),
      ),
    );
    renderApp('/login');

    await fillAndSubmit('a@example.com', 'x');

    expect(await screen.findByText(/req-9/)).toBeInTheDocument();
  });
});
