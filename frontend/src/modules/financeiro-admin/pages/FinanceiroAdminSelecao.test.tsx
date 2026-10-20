import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/apiClient';
import { renderApp } from '@/test/helpers';
import { ADMIN, lancamento, lancamentos, OBRA_ID, servidorFinanceiro } from '@/test/financeiroAdmin';
import { API, server } from '@/test/server';
import { setVisibilidadeLote } from '../api';

const LOTE = `${API}/obras/${OBRA_ID}/financeiro/lancamentos/visibilidade`;
const user = () => userEvent.setup();
const checkbox = (descricao: string) => screen.getByRole('checkbox', { name: `Selecionar lançamento: ${descricao}` });
const interruptor = (descricao: string) => screen.getByRole('switch', { name: `Visível ao cliente: ${descricao}` });
const todos = () => screen.getByRole('checkbox', { name: 'Selecionar todos os lançamentos desta página' });
const barra = () => screen.getByRole('region', { name: 'Ações em lote' });
const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).parentElement as HTMLElement;

/** 4 lançamentos: Item 01 e 03 liberados, 02 e 04 ocultos (lancamentos() alterna). */
async function abrir(n = 4) {
  const api = servidorFinanceiro(lancamentos(n));
  server.use(...api.handlers);
  renderApp(ADMIN, 'Admin');
  await screen.findByRole('table');
  return api;
}

describe('Financeiro (admin) - seleção', () => {
  it('sem seleção não há barra de lote; marcar mostra "1 selecionado" e "N selecionados"', async () => {
    await abrir();
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();

    await user().click(checkbox('Item 01'));
    expect(barra()).toHaveTextContent('1 selecionado');
    expect(barra()).not.toHaveTextContent('1 selecionados');

    await user().click(checkbox('Item 02'));
    expect(barra()).toHaveTextContent('2 selecionados');
    expect(within(barra()).getByRole('button', { name: 'Liberar ao cliente' })).toBeEnabled();
    expect(within(barra()).getByRole('button', { name: 'Ocultar do cliente' })).toBeEnabled();

    await user().click(checkbox('Item 01'));
    expect(barra()).toHaveTextContent('1 selecionado');
    await user().click(checkbox('Item 02'));
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
  });

  it('checkbox do cabeçalho: indeterminado com seleção parcial, marca e desmarca todos da página', async () => {
    await abrir();
    expect(todos()).not.toBeChecked();
    expect(todos()).not.toBePartiallyChecked();

    await user().click(checkbox('Item 01'));
    expect(todos()).toBePartiallyChecked();
    expect(todos()).not.toBeChecked();

    await user().click(todos());
    expect(todos()).toBeChecked();
    for (const nome of ['Item 01', 'Item 02', 'Item 03', 'Item 04']) expect(checkbox(nome)).toBeChecked();
    expect(barra()).toHaveTextContent('4 selecionados');

    await user().click(todos());
    for (const nome of ['Item 01', 'Item 02', 'Item 03', 'Item 04']) expect(checkbox(nome)).not.toBeChecked();
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
  });

  it('"Limpar seleção" desmarca tudo', async () => {
    await abrir();
    await user().click(todos());
    await user().click(within(barra()).getByRole('button', { name: 'Limpar seleção' }));
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
    expect(checkbox('Item 01')).not.toBeChecked();
  });

  it('a seleção do cabeçalho cobre só a página (20 de 45) e é limpa ao trocar de página', async () => {
    const api = servidorFinanceiro(lancamentos(45));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    await user().click(todos());
    expect(barra()).toHaveTextContent('20 selecionados');

    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 3');
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Item 21'));
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
    expect(todos()).not.toBeChecked();

    await user().click(screen.getByRole('button', { name: 'Anterior' }));
    await screen.findByText('Página 1 de 3');
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Item 01'));
    expect(checkbox('Item 01')).not.toBeChecked();
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
  });

  it('a seleção é limpa ao mudar um filtro', async () => {
    const api = await abrir();
    await user().click(checkbox('Item 02'));
    expect(barra()).toHaveTextContent('1 selecionado');

    await user().selectOptions(screen.getByLabelText('Visibilidade'), 'false');
    await waitFor(() => expect(api.chamadas.listas.at(-1)?.get('visivelCliente')).toBe('false'));
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Item 01'));
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
    expect(checkbox('Item 02')).not.toBeChecked();
  });

  it('com filtro ativo, o contador só conta o que ainda está na lista depois de uma mudança', async () => {
    await abrir();
    await user().selectOptions(screen.getByLabelText('Visibilidade'), 'false');
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Item 01'));
    await user().click(checkbox('Item 02'));
    await user().click(checkbox('Item 04'));
    expect(barra()).toHaveTextContent('2 selecionados');

    // Liberar o Item 02 pelo interruptor tira ele da lista filtrada (ocultos).
    await user().click(interruptor('Item 02'));
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Item 02'));
    expect(barra()).toHaveTextContent('1 selecionado');
  });
});

describe('Financeiro (admin) - ação em lote', () => {
  it('Liberar ao cliente envia PATCH com os ids marcados, avisa a quantidade, limpa a seleção e atualiza lista e KPIs', async () => {
    const api = await abrir();
    await waitFor(() => expect(kpi('Liberado ao cliente')).toHaveTextContent('2 lançamentos'));
    expect(interruptor('Item 02')).not.toBeChecked();

    await user().click(checkbox('Item 02'));
    await user().click(checkbox('Item 04'));
    await user().click(within(barra()).getByRole('button', { name: 'Liberar ao cliente' }));

    expect(await screen.findByText('2 lançamentos liberados ao cliente.')).toBeInTheDocument();
    expect(api.chamadas.lotes).toHaveLength(1);
    const { obraId, body } = api.chamadas.lotes[0] ?? { obraId: '', body: { ids: [], visivelCliente: false } };
    expect(obraId).toBe(OBRA_ID);
    expect([...body.ids].sort()).toEqual(['l02', 'l04']);
    expect(body.visivelCliente).toBe(true);
    // Só `ids` e `visivelCliente` no corpo.
    expect(Object.keys(body).sort()).toEqual(['ids', 'visivelCliente']);

    expect(screen.queryByRole('region', { name: 'Ações em lote' })).not.toBeInTheDocument();
    await waitFor(() => expect(interruptor('Item 02')).toBeChecked());
    expect(interruptor('Item 04')).toBeChecked();
    await waitFor(() => expect(kpi('Liberado ao cliente')).toHaveTextContent('4 lançamentos'));
    expect(kpi('Não liberado')).toHaveTextContent('0 lançamentos');
  });

  it('Ocultar do cliente envia visivelCliente=false e usa o singular com 1 lançamento', async () => {
    const api = await abrir();
    await user().click(checkbox('Item 01'));
    await user().click(within(barra()).getByRole('button', { name: 'Ocultar do cliente' }));

    expect(await screen.findByText('1 lançamento ocultado do cliente.')).toBeInTheDocument();
    expect(api.chamadas.lotes[0]?.body).toEqual({ ids: ['l01'], visivelCliente: false });
    await waitFor(() => expect(interruptor('Item 01')).not.toBeChecked());
  });

  it('selecionar a página inteira manda todos os ids dela (20) num único PATCH, no máximo 200 por pedido', async () => {
    const api = servidorFinanceiro(lancamentos(45));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    await user().click(todos());
    await user().click(within(barra()).getByRole('button', { name: 'Liberar ao cliente' }));
    await screen.findByText('20 lançamentos liberados ao cliente.');

    expect(api.chamadas.lotes).toHaveLength(1);
    const ids = api.chamadas.lotes[0]?.body.ids ?? [];
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(ids.length).toBeLessThanOrEqual(200);
  });

  it('os botões ficam travados enquanto o lote grava', async () => {
    const api = await abrir();
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.patch(LOTE, async () => {
        await trava;
        return HttpResponse.json({ atualizados: 1, visivelCliente: true });
      }),
    );
    await user().click(checkbox('Item 02'));
    await user().click(within(barra()).getByRole('button', { name: 'Liberar ao cliente' }));

    await waitFor(() => expect(within(barra()).getByRole('button', { name: 'Liberar ao cliente' })).toBeDisabled());
    expect(within(barra()).getByRole('button', { name: 'Ocultar do cliente' })).toBeDisabled();
    expect(within(barra()).getByRole('button', { name: 'Limpar seleção' })).toBeDisabled();
    liberar();
    await screen.findByText('1 lançamento liberado ao cliente.');
    expect(api.chamadas.lotes).toHaveLength(0); // o handler com trava respondeu no lugar da API em memória
  });

  it('400 em errors.Ids (algum id não é desta obra) mostra Alert genérico, nada é alterado e a seleção continua', async () => {
    const api = await abrir();
    server.use(
      http.patch(LOTE, () =>
        HttpResponse.json(
          { errors: { Ids: ['Um ou mais lancamentos informados nao pertencem a esta obra.'] } },
          { status: 400 },
        ),
      ),
    );
    await user().click(checkbox('Item 02'));
    await user().click(checkbox('Item 04'));
    await user().click(within(barra()).getByRole('button', { name: 'Liberar ao cliente' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/inválidos|não pertencem|Não foi possível/i);
    expect(alerta).not.toHaveTextContent(/undefined|\[object/);
    expect(screen.queryByText(/liberados ao cliente\./)).not.toBeInTheDocument();
    expect(interruptor('Item 02')).not.toBeChecked();
    expect(interruptor('Item 04')).not.toBeChecked();
    expect(barra()).toHaveTextContent('2 selecionados');
    expect(api.chamadas.lotes).toHaveLength(0);
  });

  it('403 no lote: Alert de permissão e nada muda', async () => {
    await abrir();
    server.use(http.patch(LOTE, () => HttpResponse.json({}, { status: 403 })));
    await user().click(checkbox('Item 02'));
    await user().click(within(barra()).getByRole('button', { name: 'Liberar ao cliente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(interruptor('Item 02')).not.toBeChecked();
  });

  it('500 no lote: Alert com o código de suporte e botões liberados de novo', async () => {
    await abrir();
    server.use(
      http.patch(LOTE, () =>
        HttpResponse.json({ requestId: 'req-lote', message: 'Erro interno do servidor.' }, { status: 500 }),
      ),
    );
    await user().click(checkbox('Item 02'));
    await user().click(within(barra()).getByRole('button', { name: 'Ocultar do cliente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('req-lote');
    await waitFor(() => expect(within(barra()).getByRole('button', { name: 'Liberar ao cliente' })).toBeEnabled());
    expect(barra()).toHaveTextContent('1 selecionado');
  });

  it('a camada de API manda { ids, visivelCliente } para a rota da obra e o backend recusa mais de 200 ids com 400', async () => {
    const api = servidorFinanceiro(lancamentos(2));
    server.use(...api.handlers);

    await expect(setVisibilidadeLote(OBRA_ID, ['l01', 'l02'], true)).resolves.toEqual({
      atualizados: 2,
      visivelCliente: true,
    });
    const muitos = Array.from({ length: 201 }, (_, i) => `x${i}`);
    await expect(setVisibilidadeLote(OBRA_ID, muitos, true)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('Financeiro (admin) - interruptor por linha', () => {
  it('liberar: PATCH {visivelCliente:true}, aria-checked passa a true, avisa e atualiza os KPIs', async () => {
    const api = await abrir();
    await waitFor(() => expect(kpi('Não liberado')).toHaveTextContent('2 lançamentos'));
    expect(interruptor('Item 02')).toHaveAttribute('aria-checked', 'false');

    await user().click(interruptor('Item 02'));

    expect(await screen.findByText('Lançamento liberado ao cliente.')).toBeInTheDocument();
    expect(api.chamadas.patches).toEqual([{ id: 'l02', body: { visivelCliente: true } }]);
    await waitFor(() => expect(interruptor('Item 02')).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('row', { name: /Item 02/ })).toHaveTextContent('Liberado');
    await waitFor(() => expect(kpi('Não liberado')).toHaveTextContent('1 lançamento'));
    expect(kpi('Liberado ao cliente')).toHaveTextContent('3 lançamentos');
  });

  it('ocultar: PATCH {visivelCliente:false} e aviso próprio', async () => {
    const api = await abrir();
    expect(interruptor('Item 01')).toHaveAttribute('aria-checked', 'true');

    await user().click(interruptor('Item 01'));

    expect(await screen.findByText('Lançamento ocultado do cliente.')).toBeInTheDocument();
    expect(api.chamadas.patches).toEqual([{ id: 'l01', body: { visivelCliente: false } }]);
    await waitFor(() => expect(interruptor('Item 01')).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('row', { name: /Item 01/ })).toHaveTextContent('Oculto');
  });

  it('enquanto grava, só a linha clicada fica em loading; as outras ficam travadas; ao fim tudo volta', async () => {
    const api = await abrir();
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.patch(`${API}/financeiro/lancamentos/:id/visibilidade`, async ({ params }) => {
        await trava;
        return HttpResponse.json(lancamento(String(params.id), { visivelCliente: true }));
      }),
    );

    await user().click(interruptor('Item 02'));

    await waitFor(() => expect(interruptor('Item 02')).toHaveAttribute('aria-busy', 'true'));
    expect(interruptor('Item 02')).toBeDisabled();
    for (const outro of ['Item 01', 'Item 03', 'Item 04']) {
      expect(interruptor(outro)).toBeDisabled();
      expect(interruptor(outro)).not.toHaveAttribute('aria-busy');
    }
    // Só o PATCH da linha clicada foi disparado.
    expect(api.chamadas.patches).toHaveLength(0);

    liberar();
    await screen.findByText('Lançamento liberado ao cliente.');
    await waitFor(() => expect(interruptor('Item 03')).toBeEnabled());
    for (const nome of ['Item 01', 'Item 02', 'Item 03', 'Item 04']) {
      expect(interruptor(nome)).toBeEnabled();
      expect(interruptor(nome)).not.toHaveAttribute('aria-busy');
    }
  });

  it('500: Alert com o código de suporte, o interruptor volta ao valor real (rollback) e destrava', async () => {
    await abrir();
    server.use(
      http.patch(`${API}/financeiro/lancamentos/:id/visibilidade`, () =>
        HttpResponse.json({ requestId: 'req-flag', message: 'Erro interno do servidor.' }, { status: 500 }),
      ),
    );

    await user().click(interruptor('Item 02'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-flag');
    await waitFor(() => expect(interruptor('Item 02')).toBeEnabled());
    expect(interruptor('Item 02')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('row', { name: /Item 02/ })).toHaveTextContent('Oculto');
    expect(screen.queryByText('Lançamento liberado ao cliente.')).not.toBeInTheDocument();
  });

  it('403: Alert de permissão e o interruptor não muda', async () => {
    await abrir();
    server.use(
      http.patch(`${API}/financeiro/lancamentos/:id/visibilidade`, () => HttpResponse.json({}, { status: 403 })),
    );

    await user().click(interruptor('Item 01'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    await waitFor(() => expect(interruptor('Item 01')).toBeEnabled());
    expect(interruptor('Item 01')).toHaveAttribute('aria-checked', 'true');
  });

  it('404 (excluído em outra aba): pede para atualizar a página', async () => {
    await abrir();
    server.use(
      http.patch(`${API}/financeiro/lancamentos/:id/visibilidade`, () => HttpResponse.json({}, { status: 404 })),
    );

    await user().click(interruptor('Item 02'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Lançamento não encontrado. Atualize a página.');
  });

  it('um aviso de sucesso some quando outra ação começa (não acumula com o erro)', async () => {
    await abrir();
    await user().click(interruptor('Item 02'));
    await screen.findByText('Lançamento liberado ao cliente.');

    server.use(
      http.patch(`${API}/financeiro/lancamentos/:id/visibilidade`, () => HttpResponse.json({}, { status: 403 })),
    );
    await user().click(interruptor('Item 01'));

    await screen.findByRole('alert');
    expect(screen.queryByText('Lançamento liberado ao cliente.')).not.toBeInTheDocument();
  });
});
