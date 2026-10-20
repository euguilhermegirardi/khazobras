import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { renderApp } from '@/test/helpers';
import {
  ADMIN,
  anexo,
  CLIENTE,
  CRIADO_POR,
  lancamento,
  lancamentos,
  OBRA_ID,
  resumoDe,
  servidorFinanceiro,
} from '@/test/financeiroAdmin';
import { API, server } from '@/test/server';
import { listLancamentosAdmin } from '../api';
import { COMPETENCIA_FILTRO } from '../constants';

const LISTA = `${API}/obras/${OBRA_ID}/financeiro/lancamentos`;
const RESUMO = `${API}/obras/${OBRA_ID}/financeiro/resumo`;
const CATEGORIAS_URL = `${API}/financeiro/categorias`;

const user = () => userEvent.setup();
const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).parentElement as HTMLElement;
const nomesDaSidebar = async () => {
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
  return within(nav)
    .getAllByRole('link')
    .map((l) => l.textContent?.trim());
};
const ultimaLista = (api: ReturnType<typeof servidorFinanceiro>) => api.chamadas.listas.at(-1);

describe('Financeiro (admin) - estados da lista', () => {
  it('mostra carregando e depois a tabela com os dados de cada lançamento', async () => {
    const api = servidorFinanceiro([
      lancamento('a', {
        categoria: 'MaoDeObra',
        descricao: 'Pedreiro - semana 2',
        valor: 2300.75,
        dataLancamento: '2026-09-10',
        mesCompetencia: '2026-09-01',
        visivelCliente: true,
        anexos: [anexo('x1'), anexo('x2')],
      }),
      lancamento('b', { descricao: 'Cimento CP-II', visivelCliente: false }),
    ]);
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando lançamentos');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo lançamento' })).toBeInTheDocument();

    const a = screen.getByRole('row', { name: /Pedreiro - semana 2/ });
    expect(a).toHaveTextContent('10/09/2026');
    expect(a).toHaveTextContent('Setembro de 2026');
    expect(a).toHaveTextContent('Mão de obra');
    expect(a).toHaveTextContent(/R\$\s*2\.300,75/);
    expect(a).toHaveTextContent('2 anexos');
    expect(a).toHaveTextContent('Liberado');
    expect(screen.getByRole('switch', { name: 'Visível ao cliente: Pedreiro - semana 2' })).toBeChecked();

    const b = screen.getByRole('row', { name: /Cimento CP-II/ });
    expect(b).toHaveTextContent('Material');
    expect(b).toHaveTextContent('Sem anexos');
    expect(b).toHaveTextContent('Oculto');
    expect(screen.getByRole('switch', { name: 'Visível ao cliente: Cimento CP-II' })).not.toBeChecked();
  });

  it('1 anexo no singular', async () => {
    server.use(...servidorFinanceiro([lancamento('a', { anexos: [anexo('x1')] })]).handlers);
    renderApp(ADMIN, 'Admin');
    expect(await screen.findByText('1 anexo')).toBeInTheDocument();
  });

  it('erro 500 na lista mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    // Num mesmo `server.use`, o que vem primeiro tem prioridade: o erro vai antes da API em memória.
    server.use(
      http.get(LISTA, () =>
        HttpResponse.json({ requestId: 'req-fin-lista', message: 'Erro interno do servidor.' }, { status: 500 }),
      ),
      ...servidorFinanceiro().handlers,
    );
    renderApp(ADMIN, 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-fin-lista');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    server.use(...servidorFinanceiro([lancamento('a', { descricao: 'Depois do retry' })]).handlers);
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('table')).toHaveTextContent('Depois do retry');
  });

  it('erro 403 na lista mostra "sem permissão"', async () => {
    server.use(
      http.get(LISTA, () => HttpResponse.json({}, { status: 403 })),
      ...servidorFinanceiro().handlers,
    );
    renderApp(ADMIN, 'Admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('obra sem lançamentos e sem filtro: vazio com orientação, sem filtros e com o botão de criar', async () => {
    server.use(...servidorFinanceiro([]).handlers);
    renderApp(ADMIN, 'Admin');

    expect(await screen.findByText('Nenhum lançamento nesta obra ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo lançamento' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Visibilidade')).not.toBeInTheDocument();
    // Resumo de obra vazia = zeros.
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent(/R\$\s*0,00/));
    expect(kpi('Total lançado')).toHaveTextContent('0 lançamentos');
  });

  it('vazio com filtro: mensagem própria, filtros continuam e "Limpar filtros" volta à lista', async () => {
    const api = servidorFinanceiro([lancamento('a', { descricao: 'Só oculto', visivelCliente: false })]);
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    await user().selectOptions(screen.getByLabelText('Visibilidade'), 'true');

    expect(await screen.findByText('Nenhum lançamento com estes filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum lançamento nesta obra ainda.')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Visibilidade')).toHaveValue('true');

    await user().click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByRole('table')).toHaveTextContent('Só oculto');
    expect(screen.getByLabelText('Visibilidade')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
    expect(ultimaLista(api)?.has('visivelCliente')).toBe(false);
  });
});

describe('Financeiro (admin) - KPIs do resumo', () => {
  it('mostra Total lançado, Liberado ao cliente e Não liberado com as quantidades', async () => {
    const lista = [
      lancamento('a', { valor: 1500, visivelCliente: true }),
      lancamento('b', { valor: 500.5, visivelCliente: false }),
      lancamento('c', { valor: 250, visivelCliente: false }),
    ];
    server.use(...servidorFinanceiro(lista).handlers);
    renderApp(ADMIN, 'Admin');

    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent(/R\$\s*2\.250,50/));
    expect(kpi('Total lançado')).toHaveTextContent('3 lançamentos');
    expect(kpi('Liberado ao cliente')).toHaveTextContent(/R\$\s*1\.500,00/);
    expect(kpi('Liberado ao cliente')).toHaveTextContent('1 lançamento');
    expect(kpi('Liberado ao cliente')).not.toHaveTextContent('1 lançamentos');
    expect(kpi('Não liberado')).toHaveTextContent(/R\$\s*750,50/);
    expect(kpi('Não liberado')).toHaveTextContent('2 lançamentos');
  });

  it('os KPIs refletem a obra inteira, não só a página (resumo vem do servidor)', async () => {
    const lista = lancamentos(45);
    server.use(...servidorFinanceiro(lista).handlers);
    renderApp(ADMIN, 'Admin');

    await screen.findByRole('table');
    const esperado = resumoDe(lista);
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent('45 lançamentos'));
    expect(kpi('Liberado ao cliente')).toHaveTextContent(`${esperado.quantidadeLiberada} lançamentos`);
    expect(kpi('Não liberado')).toHaveTextContent(`${esperado.quantidadeNaoLiberada} lançamentos`);
  });

  it.each([
    ['500', 500, { requestId: 'req-resumo', message: 'Erro interno do servidor.' }],
    ['403', 403, {}],
  ])('falha %s no resumo mostra "—" e não derruba a tabela', async (_nome, status, body) => {
    server.use(
      http.get(RESUMO, () => HttpResponse.json(body, { status })),
      ...servidorFinanceiro([lancamento('a', { descricao: 'Segue na tela' })]).handlers,
    );
    renderApp(ADMIN, 'Admin');

    expect(await screen.findByRole('table')).toHaveTextContent('Segue na tela');
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent('—'));
    expect(kpi('Liberado ao cliente')).toHaveTextContent('—');
    expect(kpi('Não liberado')).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: '+ Novo lançamento' })).toBeInTheDocument();
    // O erro do resumo não vira o ErrorState da página.
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('enquanto o resumo carrega os KPIs mostram "—" e a tabela já aparece', async () => {
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.get(RESUMO, async () => {
        await trava;
        return HttpResponse.json({ ...resumoDe([lancamento('a', { valor: 100, visivelCliente: true })]) });
      }),
      ...servidorFinanceiro([lancamento('a', { valor: 100, visivelCliente: true })]).handlers,
    );
    renderApp(ADMIN, 'Admin');

    await screen.findByRole('table');
    expect(kpi('Total lançado')).toHaveTextContent('—');
    liberar();
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent(/R\$\s*100,00/));
  });
});

describe('Financeiro (admin) - papel e sidebar', () => {
  it('cliente é barrado em /admin/obras/:obraId/financeiro: "Sem permissão", sem ação de admin e sem chamadas', async () => {
    // Sem handlers: qualquer chamada falharia o teste (onUnhandledFrame = error).
    renderApp(ADMIN, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /novo lançamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Total lançado')).not.toBeInTheDocument();
  });

  it('deslogado vai para o login', async () => {
    renderApp(ADMIN);
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('Master também acessa', async () => {
    server.use(...servidorFinanceiro([lancamento('a', { descricao: 'Visto pelo master' })]).handlers);
    renderApp(ADMIN, 'Master');
    expect(await screen.findByRole('table')).toHaveTextContent('Visto pelo master');
  });

  it('sidebar do admin: Medições, Financeiro, Contratos nessa ordem, com o link da obra aberta e ativo', async () => {
    server.use(...servidorFinanceiro([]).handlers);
    renderApp(ADMIN, 'Admin');

    const nomes = await nomesDaSidebar();
    const i = nomes.indexOf('Financeiro');
    expect(i).toBeGreaterThan(-1);
    expect(nomes.slice(i - 1, i + 2)).toEqual(['Medições', 'Financeiro', 'Contratos']);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const link = within(nav).getByRole('link', { name: 'Financeiro' });
    expect(link).toHaveAttribute('href', ADMIN);
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('sidebar do cliente: o "Financeiro" dele aponta para a rota do cliente, nunca para a do admin', async () => {
    const api = servidorFinanceiro([lancamento('a', { descricao: 'Liberado', visivelCliente: true })]);
    server.use(...api.handlers);
    renderApp(CLIENTE, 'Client');

    const nomes = await nomesDaSidebar();
    expect(nomes.filter((n) => n === 'Financeiro')).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: 'Financeiro' })).toHaveAttribute('href', CLIENTE);
    expect(nav.querySelector('a[href^="/admin"]')).toBeNull();
    // Medições do admin não aparece na do cliente.
    expect(nomes).not.toContain('Medições');
  });

  it('regra 7: o cliente nunca chama o resumo (custo real) nem as categorias, e não vê ação de admin', async () => {
    const api = servidorFinanceiro([lancamento('a', { descricao: 'Liberado ao cliente', visivelCliente: true })]);
    server.use(...api.handlers);
    renderApp(CLIENTE, 'Client');

    expect(await screen.findByText('Liberado ao cliente')).toBeInTheDocument();
    expect(screen.queryByText('Total lançado')).not.toBeInTheDocument();
    expect(screen.queryByText('Não liberado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /novo lançamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar|excluir/i })).not.toBeInTheDocument();
    expect(api.chamadas.resumos).toBe(0);
    expect(api.chamadas.categorias).toBe(0);
    // Os filtros do admin nem são pedidos pela tela do cliente.
    expect(api.chamadas.listas.every((p) => !p.has('visivelCliente') && !p.has('competencia'))).toBe(true);
  });
});

describe('Financeiro (admin) - regra 7 e dados internos', () => {
  it('createdByUserId vem no JSON mas nunca aparece na tela (nem na lista, nem no editar)', async () => {
    server.use(...servidorFinanceiro([lancamento('a', { descricao: 'Com dono interno' })]).handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    expect(document.body.innerHTML).not.toContain(CRIADO_POR);
    expect(document.body.textContent).not.toMatch(/createdBy|criado por/i);

    await user().click(screen.getByRole('button', { name: 'Editar lançamento: Com dono interno' }));
    await screen.findByRole('dialog', { name: 'Editar lançamento' });
    expect(document.body.innerHTML).not.toContain(CRIADO_POR);
  });

  it('o tipo LancamentoAdmin não declara createdByUserId', () => {
    expectTypeOf<LancamentoAdmin>().not.toHaveProperty('createdByUserId');
    expectTypeOf<LancamentoAdmin>().toHaveProperty('visivelCliente');
  });
});

describe('Financeiro (admin) - filtros', () => {
  it('pede a primeira página com 20 itens e sem filtros', async () => {
    const api = servidorFinanceiro(lancamentos(3));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    const p = ultimaLista(api);
    expect(p?.get('pageIndex')).toBe('0');
    expect(p?.get('pageSize')).toBe('20');
    expect(p?.has('visivelCliente')).toBe(false);
    expect(p?.has('categoria')).toBe(false);
    expect(p?.has('competencia')).toBe(false);
  });

  it('visibilidade: "Liberados" pede visivelCliente=true, "Ocultos" pede false e "Todos" tira o parâmetro', async () => {
    const api = servidorFinanceiro(lancamentos(4));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const select = screen.getByLabelText('Visibilidade');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos', 'Liberados ao cliente', 'Ocultos do cliente']);

    await user().selectOptions(select, 'Liberados ao cliente');
    await waitFor(() => expect(ultimaLista(api)?.get('visivelCliente')).toBe('true'));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));

    await user().selectOptions(select, 'Ocultos do cliente');
    await waitFor(() => expect(ultimaLista(api)?.get('visivelCliente')).toBe('false'));
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Item 01'));

    await user().selectOptions(select, 'Todos');
    await waitFor(() => expect(ultimaLista(api)?.has('visivelCliente')).toBe(false));
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5));
  });

  it('categoria: opções vindas de GET /financeiro/categorias e o filtro envia o valor snake_case', async () => {
    const api = servidorFinanceiro([
      lancamento('a', { categoria: 'MaoDeObra', descricao: 'Pedreiro' }),
      lancamento('b', { categoria: 'Material', descricao: 'Cimento' }),
    ]);
    server.use(
      http.get(CATEGORIAS_URL, () =>
        HttpResponse.json([
          { valor: 'mao_de_obra', rotulo: 'Mão de obra (do servidor)' },
          { valor: 'material', rotulo: 'Material' },
          { valor: 'equipamento', rotulo: 'Equipamento' },
        ]),
      ),
      ...api.handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const select = screen.getByLabelText('Categoria');
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: 'Mão de obra (do servidor)' })).toBeInTheDocument(),
    );

    await user().selectOptions(select, 'Mão de obra (do servidor)');
    await waitFor(() => expect(ultimaLista(api)?.get('categoria')).toBe('mao_de_obra'));
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Cimento'));
    expect(screen.getByRole('table')).toHaveTextContent('Pedreiro');
  });

  it('se GET /financeiro/categorias falhar, o select usa as 3 categorias do enum', async () => {
    const api = servidorFinanceiro([lancamento('a', { categoria: 'Equipamento', descricao: 'Betoneira' })]);
    server.use(
      http.get(CATEGORIAS_URL, () => HttpResponse.json({}, { status: 500 })),
      ...api.handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const select = screen.getByLabelText('Categoria');

    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Todas', 'Mão de obra', 'Material', 'Equipamento']),
    );
    await user().selectOptions(select, 'Equipamento');
    await waitFor(() => expect(ultimaLista(api)?.get('categoria')).toBe('equipamento'));
    expect(screen.getByRole('table')).toHaveTextContent('Betoneira');
  });

  it('competência: o input de mês filtra por yyyy-MM', async () => {
    const api = servidorFinanceiro([
      lancamento('a', { descricao: 'De setembro', mesCompetencia: '2026-09-01' }),
      lancamento('b', { descricao: 'De outubro', mesCompetencia: '2026-10-01' }),
    ]);
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-10' } });

    await waitFor(() => expect(ultimaLista(api)?.get('competencia')).toBe('2026-10'));
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('De setembro'));
    expect(screen.getByRole('table')).toHaveTextContent('De outubro');
  });

  it('competência incompleta (navegador sem input de mês) não vai à API; completa, vai', async () => {
    // Simula um navegador sem input de mês: `type="month"` vira texto livre (o jsdom zeraria o valor inválido).
    const original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'type');
    Object.defineProperty(HTMLInputElement.prototype, 'type', {
      ...original,
      set(this: HTMLInputElement, valor: string) {
        original?.set?.call(this, valor === 'month' ? 'text' : valor);
      },
    });
    try {
      const api = servidorFinanceiro(lancamentos(2));
      server.use(...api.handlers);
      renderApp(ADMIN, 'Admin');
      await screen.findByRole('table');
      const campo = screen.getByLabelText('Competência');
      const antes = api.chamadas.listas.length;

      fireEvent.change(campo, { target: { value: '2026-9' } });

      expect(campo).toHaveValue('2026-9');
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Dá tempo de uma consulta indevida sair.
      await new Promise((r) => setTimeout(r, 150));
      expect(api.chamadas.listas.length).toBe(antes);
      expect(api.chamadas.listas.every((p) => !p.has('competencia'))).toBe(true);
      expect(screen.queryByText(/dados inválidos/i)).not.toBeInTheDocument();

      fireEvent.change(campo, { target: { value: '2026-09' } });
      await waitFor(() => expect(ultimaLista(api)?.get('competencia')).toBe('2026-09'));
    } finally {
      if (original) Object.defineProperty(HTMLInputElement.prototype, 'type', original);
    }
  });

  it('mudar qualquer filtro volta à página 1 (pageIndex=0)', async () => {
    const api = servidorFinanceiro(lancamentos(45));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(ultimaLista(api)?.get('pageIndex')).toBe('1'));
    await screen.findByText('Página 2 de 3');

    await user().selectOptions(screen.getByLabelText('Visibilidade'), 'true');
    await waitFor(() => expect(ultimaLista(api)?.get('visivelCliente')).toBe('true'));
    expect(ultimaLista(api)?.get('pageIndex')).toBe('0');
    await screen.findByText('Página 1 de 2');

    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(ultimaLista(api)?.get('pageIndex')).toBe('1'));
    await user().selectOptions(screen.getByLabelText('Categoria'), 'Material');
    await waitFor(() => expect(ultimaLista(api)?.get('categoria')).toBe('material'));
    expect(ultimaLista(api)?.get('pageIndex')).toBe('0');
  });

  it('o valor de COMPETENCIA_FILTRO só aceita yyyy-MM completo', () => {
    expect(COMPETENCIA_FILTRO.test('2026-09')).toBe(true);
    for (const ruim of ['', '2026-9', '2026-13', '2026-00', '2026-09-01', 'set/2026', '26-09']) {
      expect(COMPETENCIA_FILTRO.test(ruim)).toBe(false);
    }
  });

  it('a camada de API omite competência incompleta e mantém os outros filtros', async () => {
    const pedidos: URLSearchParams[] = [];
    server.use(
      http.get(LISTA, ({ request }) => {
        pedidos.push(new URL(request.url).searchParams);
        return HttpResponse.json({ totalItems: 0, pageIndex: 0, pageSize: 20, items: [] });
      }),
    );

    await listLancamentosAdmin(OBRA_ID, {
      pageIndex: 2,
      pageSize: 20,
      filtros: { visivelCliente: 'false', categoria: 'material', competencia: '2026-9' },
    });
    await listLancamentosAdmin(OBRA_ID, {
      pageIndex: 0,
      pageSize: 20,
      filtros: { visivelCliente: '', categoria: '', competencia: '2026-09' },
    });

    expect(Object.fromEntries(pedidos[0] ?? [])).toEqual({
      pageIndex: '2',
      pageSize: '20',
      visivelCliente: 'false',
      categoria: 'material',
    });
    expect(Object.fromEntries(pedidos[1] ?? [])).toEqual({ pageIndex: '0', pageSize: '20', competencia: '2026-09' });
  });
});

describe('Financeiro (admin) - paginação (20 por página)', () => {
  it('45 lançamentos = 3 páginas: Anterior desabilitado na primeira, Próxima pede pageIndex=1 e mostra os itens seguintes', async () => {
    const api = servidorFinanceiro(lancamentos(45));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.getByText('45 lançamentos', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('table')).toHaveTextContent('Item 01');
    expect(screen.getByRole('table')).not.toHaveTextContent('Item 21');

    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 3');
    expect(ultimaLista(api)?.get('pageIndex')).toBe('1');
    expect(screen.getByRole('table')).toHaveTextContent('Item 21');
    expect(screen.getByRole('table')).not.toHaveTextContent('Item 01');

    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 3 de 3');
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await user().click(screen.getByRole('button', { name: 'Anterior' }));
    await screen.findByText('Página 2 de 3');
  });

  it('1 lançamento usa o singular no total', async () => {
    server.use(...servidorFinanceiro([lancamento('a')]).handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    expect(screen.getByText('1 lançamento', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });

  it('trocar de página mantém a tabela anterior na tela até a nova chegar', async () => {
    const api = servidorFinanceiro(lancamentos(25));
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    server.use(
      http.get(LISTA, async ({ request }) => {
        await trava;
        const items = lancamentos(25).slice(20);
        return HttpResponse.json({
          totalItems: 25,
          pageIndex: Number(new URL(request.url).searchParams.get('pageIndex')),
          pageSize: 20,
          items,
        });
      }),
    );
    await user().click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByRole('table')).toHaveTextContent('Item 01');
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    liberar();
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Item 21'));
  });
});

describe('Financeiro (admin) - datas no fuso de São Paulo', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('data dd/mm/aaaa sem recuar um dia e competência em título ("Setembro de 2026")', async () => {
    expect(new Date('2026-09-10').getDate()).toBe(9); // prova de que o fuso do teste é o de São Paulo
    server.use(
      ...servidorFinanceiro([
        lancamento('a', { descricao: 'Primeiro dia', dataLancamento: '2026-10-01', mesCompetencia: '2026-10-01' }),
        lancamento('b', { descricao: 'Último dia', dataLancamento: '2026-12-31', mesCompetencia: '2026-12-01' }),
        lancamento('c', { descricao: 'Meio do mês', dataLancamento: '2026-09-10', mesCompetencia: '2026-09-01' }),
      ]).handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    const a = screen.getByRole('row', { name: /Primeiro dia/ });
    expect(a).toHaveTextContent('01/10/2026');
    expect(a).toHaveTextContent('Outubro de 2026');
    const b = screen.getByRole('row', { name: /Último dia/ });
    expect(b).toHaveTextContent('31/12/2026');
    expect(b).toHaveTextContent('Dezembro de 2026');
    const c = screen.getByRole('row', { name: /Meio do mês/ });
    expect(c).toHaveTextContent('10/09/2026');
    expect(c).toHaveTextContent('Setembro de 2026');
    expect(c).not.toHaveTextContent('De 2026');
  });

  it('no editar, data e competência chegam nos campos sem recuar um dia', async () => {
    server.use(
      ...servidorFinanceiro([
        lancamento('a', { descricao: 'Fuso', dataLancamento: '2026-10-01', mesCompetencia: '2026-10-01' }),
      ]).handlers,
    );
    renderApp(ADMIN, 'Admin');
    await user().click(await screen.findByRole('button', { name: 'Editar lançamento: Fuso' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar lançamento' });
    expect(within(dialog).getByLabelText('Data do lançamento')).toHaveValue('2026-10-01');
    expect(within(dialog).getByLabelText('Competência')).toHaveValue('2026-10');
  });
});

describe('Financeiro (admin) - texto longo e valor grande', () => {
  it('descrição longa fica inteira no title e valor grande é formatado em reais', async () => {
    const longa = `Fornecimento e instalação de esquadrias ${'muito longas '.repeat(15)}`.trim();
    server.use(
      ...servidorFinanceiro([lancamento('a', { descricao: longa, valor: 12345678.9, categoria: 'Equipamento' })])
        .handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');

    const celula = screen.getByText(longa);
    expect(celula).toHaveAttribute('title', longa);
    const linha = screen.getByRole('row', { name: new RegExp('Fornecimento e instalação') });
    expect(linha).toHaveTextContent(/R\$\s*12\.345\.678,90/);
    expect(linha).toHaveTextContent('Equipamento');
  });
});
