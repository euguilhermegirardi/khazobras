import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MedicaoResumo } from '@/interfaces/medicao';
import {
  chamadasDaTabela,
  chamadasDosKpis,
  etapasApi,
  etapasComErro,
  LISTA,
  medicao,
  OBRA_ID,
  resumo,
  resumoApi,
} from '@/test/medicoesAdmin';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();

const pendente = resumo({ id: 'm3', numero: 3, competencia: '2026-10-01', valorTotal: 2500.5, quantidadeItens: 2 });
const aprovada = resumo({
  id: 'm2',
  numero: 2,
  competencia: '2026-09-01',
  valorTotal: 12000,
  status: 'Approved',
  etapaId: 'e1',
  etapaNome: 'Fundação',
  approvedAt: '2026-09-25T15:00:00Z',
});
const comNf = resumo({
  id: 'm1',
  numero: 1,
  competencia: '2026-08-01',
  valorTotal: 8000,
  status: 'InvoiceIssued',
  approvedAt: '2026-08-20T15:00:00Z',
  nfIssuedAt: '2026-08-28T15:00:00Z',
  nfNumber: 'NF-2026-0042',
});
const TRES = [pendente, aprovada, comNf];

/** Card de indicador pelo rótulo (o mesmo texto aparece em badge/opção de filtro, que não são `<p>`). */
const KPI = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).parentElement as HTMLElement;

/** Lista com `n` medições, da mais nova (n) para a mais antiga (1), para testar paginação. */
const muitas = (n: number): MedicaoResumo[] =>
  Array.from({ length: n }, (_, i) => resumo({ id: `x${n - i}`, numero: n - i, valorTotal: 100 * (n - i) }));

describe('Medições (admin) - lista', () => {
  it('mostra carregando e depois a tabela com número, competência, etapa, itens, valor, status e NF', async () => {
    server.use(resumoApi(TRES).handler, etapasApi([]));
    renderApp(LISTA, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando medições');
    expect(await screen.findByRole('heading', { name: 'Medições' })).toBeInTheDocument();

    const tabela = await screen.findByRole('table');
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(4); // cabeçalho + 3
    const l3 = linhas[1] as HTMLElement;
    expect(within(l3).getByRole('link', { name: 'Abrir medição 3' })).toBeInTheDocument();
    expect(l3).toHaveTextContent('Outubro de 2026');
    expect(l3).toHaveTextContent(/R\$\s*2\.500,50/);
    const l2 = linhas[2] as HTMLElement;
    expect(l2).toHaveTextContent('Fundação');
    expect(l2).toHaveTextContent(/R\$\s*12\.000,00/);
    const l1 = linhas[3] as HTMLElement;
    expect(l1).toHaveTextContent('NF-2026-0042');
    expect(l1).toHaveTextContent('28/08/2026');
  });

  it('mostra o status em linguagem clara, nunca o nome interno do enum', async () => {
    server.use(resumoApi(TRES).handler);
    renderApp(LISTA, 'Admin');
    const tabela = await screen.findByRole('table');

    expect(within(tabela).getByText('Aguardando aprovação do cliente')).toBeInTheDocument();
    expect(within(tabela).getByText('Aprovada — emitir NF')).toBeInTheDocument();
    expect(within(tabela).getByText('NF emitida')).toBeInTheDocument();
    expect(screen.queryByText(/PendingApproval|InvoiceIssued|pending_approval|invoice_issued/)).not.toBeInTheDocument();
  });

  it('o link do número leva ao detalhe da medição', async () => {
    server.use(resumoApi(TRES).handler);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByRole('link', { name: 'Abrir medição 2' })).toHaveAttribute(
      'href',
      `/admin/obras/${OBRA_ID}/medicoes/m2`,
    );
  });

  it('clicar no número abre o detalhe', async () => {
    const m = medicao({ id: 'm2', numero: 2, status: 'Approved' });
    server.use(
      resumoApi(TRES).handler,
      etapasApi([]),
      http.get(`${API}/medicoes/m2`, () => HttpResponse.json(m)),
    );
    renderApp(LISTA, 'Admin');

    await user().click(await screen.findByRole('link', { name: 'Abrir medição 2' }));
    expect(await screen.findByRole('heading', { name: 'Medição 2' })).toBeInTheDocument();
  });

  it('lista vazia (sem filtro) mostra mensagem e mantém o botão de criar', async () => {
    server.use(resumoApi([]).handler);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByText('Nenhuma medição foi criada nesta obra ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nova medição' })).toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    server.use(
      resumoApi([], { erro: { status: 500, body: { requestId: 'req-lista-500', message: 'Erro interno.' } } }).handler,
    );
    renderApp(LISTA, 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-lista-500');
    server.use(resumoApi(TRES).handler);
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('erro 403 mostra sem permissão e nenhuma medição', async () => {
    server.use(resumoApi([], { erro: { status: 403, body: {} } }).handler);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Master também acessa a lista', async () => {
    server.use(resumoApi(TRES).handler);
    renderApp(LISTA, 'Master');
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

describe('Medições (admin) - KPIs', () => {
  it('faz 4 consultas com pageSize=1 (todas + 1 por status) e mostra a contagem da obra inteira', async () => {
    const api = resumoApi(TRES);
    server.use(api.handler);
    renderApp(LISTA, 'Admin');
    await screen.findByRole('table');

    await waitFor(() => expect(KPI('Total de medições')).toHaveTextContent('3'));
    expect(KPI('Aguardando aprovação')).toHaveTextContent('1');
    expect(KPI('Aprovadas, aguardando NF')).toHaveTextContent('1');
    expect(KPI('NF emitida')).toHaveTextContent('1');

    const kpis = chamadasDosKpis(api.chamadas);
    expect(new Set(kpis.map((c) => c.get('status') ?? 'todas'))).toEqual(
      new Set(['todas', 'approved', 'invoice_issued', 'pending_approval']),
    );
    // SPEC/PLAN: são 4 chamadas, uma por indicador; a mesma consulta não pode se repetir.
    expect(kpis).toHaveLength(4);
    for (const c of kpis) expect(c.get('pageIndex')).toBe('0');
  });

  it('a contagem vale para a obra toda, não só para a página visível', async () => {
    server.use(resumoApi(muitas(45)).handler);
    renderApp(LISTA, 'Admin');
    await screen.findByRole('table');

    await waitFor(() => expect(KPI('Total de medições')).toHaveTextContent('45'));
    expect(KPI('Aguardando aprovação')).toHaveTextContent('45');
    expect(KPI('Aprovadas, aguardando NF')).toHaveTextContent('0');
  });

  it('se uma consulta de KPI falhar, esse KPI mostra "—" e o resto da tela continua funcionando', async () => {
    server.use(resumoApi(TRES, { falhaNoStatus: 'approved' }).handler);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    await waitFor(() => expect(KPI('Total de medições')).toHaveTextContent('3'));
    await waitFor(() => expect(KPI('Aprovadas, aguardando NF')).toHaveTextContent('—'));
    expect(KPI('Aguardando aprovação')).toHaveTextContent('1');
    expect(KPI('NF emitida')).toHaveTextContent('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('se a consulta do total falhar, o KPI "Total" mostra "—" e a tabela aparece', async () => {
    server.use(resumoApi(TRES, { falhaNoStatus: 'todas' }).handler);
    renderApp(LISTA, 'Admin');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    await waitFor(() => expect(KPI('Total de medições')).toHaveTextContent('—'));
    expect(KPI('Aguardando aprovação')).toHaveTextContent('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Medições (admin) - paginação e filtro', () => {
  it('pede 20 por página e navega entre páginas', async () => {
    const api = resumoApi(muitas(45));
    server.use(api.handler);
    renderApp(LISTA, 'Admin');
    const u = user();

    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByRole('row')).toHaveLength(21); // cabeçalho + 20
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('45 medições')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(chamadasDaTabela(api.chamadas)[0]?.get('pageSize')).toBe('20');

    await u.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Abrir medição 25' })).toBeInTheDocument());
    expect(chamadasDaTabela(api.chamadas).at(-1)?.get('pageIndex')).toBe('1');

    await u.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(6)); // cabeçalho + 5
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

  it('filtro por status envia o status em snake_case e volta para a página 1', async () => {
    const api = resumoApi(muitas(45));
    server.use(api.handler);
    renderApp(LISTA, 'Admin');
    const u = user();

    await screen.findByRole('table');
    await u.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 3');

    await u.selectOptions(screen.getByLabelText('Filtrar por status'), 'Aprovada — emitir NF');
    await waitFor(() => expect(chamadasDaTabela(api.chamadas).at(-1)?.get('status')).toBe('approved'));
    expect(chamadasDaTabela(api.chamadas).at(-1)?.get('pageIndex')).toBe('0');
  });

  it.each([
    ['Aguardando aprovação do cliente', 'pending_approval'],
    ['Aprovada — emitir NF', 'approved'],
    ['NF emitida', 'invoice_issued'],
  ])('opção "%s" envia status=%s e mostra só as medições desse status', async (rotulo, valor) => {
    const api = resumoApi(TRES);
    server.use(api.handler);
    renderApp(LISTA, 'Admin');

    await screen.findByRole('table');
    await user().selectOptions(screen.getByLabelText('Filtrar por status'), rotulo);

    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));
    expect(chamadasDaTabela(api.chamadas).at(-1)?.get('status')).toBe(valor);
  });

  it('"Todos os status" remove o parâmetro status', async () => {
    const api = resumoApi(TRES);
    server.use(api.handler);
    renderApp(LISTA, 'Admin');
    const u = user();

    await screen.findByRole('table');
    await u.selectOptions(screen.getByLabelText('Filtrar por status'), 'NF emitida');
    await waitFor(() => expect(chamadasDaTabela(api.chamadas).at(-1)?.get('status')).toBe('invoice_issued'));
    await u.selectOptions(screen.getByLabelText('Filtrar por status'), 'Todos os status');
    await waitFor(() => expect(chamadasDaTabela(api.chamadas).at(-1)?.has('status')).toBe(false));
  });

  it('filtro sem resultado mostra "vazio com filtro" e mantém o filtro para trocar', async () => {
    server.use(resumoApi([pendente]).handler);
    renderApp(LISTA, 'Admin');

    await screen.findByRole('table');
    await user().selectOptions(screen.getByLabelText('Filtrar por status'), 'NF emitida');

    expect(await screen.findByText('Nenhuma medição com este status.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma medição foi criada nesta obra ainda.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por status')).toBeInTheDocument();
  });
});

describe('Medições (admin) - criar medição', () => {
  const abrir = async (u: ReturnType<typeof user>) => {
    await u.click(await screen.findByRole('button', { name: '+ Nova medição' }));
    return screen.findByRole('dialog', { name: 'Nova medição' });
  };

  /** POST /medicoes que guarda o corpo e responde 201 com o detalhe (ou o erro dado). */
  const postMedicao = (resposta?: { status: number; body: unknown }) => {
    const enviados: Record<string, unknown>[] = [];
    const handler = http.post(`${API}/medicoes`, async ({ request }) => {
      enviados.push((await request.json()) as Record<string, unknown>);
      if (resposta) return HttpResponse.json(resposta.body as never, { status: resposta.status });
      return HttpResponse.json(medicao({ id: 'novo', numero: Number(enviados.at(-1)?.numero ?? 0) }), {
        status: 201,
      });
    });
    return { handler, enviados };
  };

  const preencherItem = async (dialog: HTMLElement, n: number, descricao: string, qtd: string, unit: string) => {
    const u = user();
    const desc = within(dialog).getByLabelText(`Descrição do item ${n}`);
    await u.clear(desc);
    await u.type(desc, descricao);
    const q = within(dialog).getByLabelText(`Quantidade do item ${n}`);
    await u.clear(q);
    await u.type(q, qtd);
    const v = within(dialog).getByLabelText(`Valor unitário do item ${n}`);
    await u.clear(v);
    await u.type(v, unit);
  };

  const definirCompetencia = (dialog: HTMLElement, valor: string) =>
    fireEvent.change(within(dialog).getByLabelText('Competência (mês)'), { target: { value: valor } });

  describe('abertura e número padrão', () => {
    it('sugere maior número + 1 (não a quantidade) e competência do mês atual', async () => {
      // ordem de criação (mais nova primeiro) com números fora de ordem: 7, 4, 2 -> sugere 8
      server.use(
        resumoApi([resumo({ id: 'a', numero: 4 }), resumo({ id: 'b', numero: 7 }), resumo({ id: 'c', numero: 2 })])
          .handler,
        etapasApi([]),
      );
      renderApp(LISTA, 'Admin');
      const dialog = await abrir(user());

      expect(within(dialog).getByLabelText('Número')).toHaveValue('8');
      const hoje = new Date();
      const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      expect(within(dialog).getByLabelText('Competência (mês)')).toHaveValue(mes);
      expect(within(dialog).getByLabelText('Etapa (opcional)')).toBeInTheDocument();
      expect(within(dialog).getAllByLabelText(/^Descrição do item/)).toHaveLength(1);
    });

    it('com a lista vazia sugere o número 1', async () => {
      server.use(resumoApi([]).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const dialog = await abrir(user());
      expect(within(dialog).getByLabelText('Número')).toHaveValue('1');
    });

    it('o número sugerido continua editável', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      expect(within(dialog).getByLabelText('Número')).toHaveValue('4');
      await u.clear(within(dialog).getByLabelText('Número'));
      await u.type(within(dialog).getByLabelText('Número'), '12');
      expect(within(dialog).getByLabelText('Número')).toHaveValue('12');
    });

    it('Cancelar fecha o diálogo sem enviar nada e a próxima abertura começa limpa', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      let dialog = await abrir(u);

      await u.type(within(dialog).getByLabelText('Descrição do item 1'), 'Rascunho');
      await u.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(post.enviados).toHaveLength(0);

      dialog = await abrir(u);
      expect(within(dialog).getByLabelText('Descrição do item 1')).toHaveValue('');
    });
  });

  describe('itens e totais', () => {
    it('adiciona e remove itens; o último item não pode ser removido', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      expect(within(dialog).getByRole('button', { name: 'Remover item 1' })).toBeDisabled();
      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      expect(within(dialog).getAllByLabelText(/^Descrição do item/)).toHaveLength(3);
      expect(within(dialog).getByRole('button', { name: 'Remover item 1' })).toBeEnabled();

      await u.type(within(dialog).getByLabelText('Descrição do item 3'), 'Terceiro');
      await u.click(within(dialog).getByRole('button', { name: 'Remover item 2' }));
      expect(within(dialog).getAllByLabelText(/^Descrição do item/)).toHaveLength(2);
      // o item que era o 3º virou o 2º, com o texto preservado
      expect(within(dialog).getByLabelText('Descrição do item 2')).toHaveValue('Terceiro');

      await u.click(within(dialog).getByRole('button', { name: 'Remover item 2' }));
      expect(within(dialog).getAllByLabelText(/^Descrição do item/)).toHaveLength(1);
      expect(within(dialog).getByRole('button', { name: 'Remover item 1' })).toBeDisabled();
    });

    it('mostra o total de cada item e o total da medição enquanto digita (prévia)', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'Cimento', '2,5', '10,10');
      expect(within(dialog).getByText(/Total do item 1/).parentElement).toHaveTextContent(/R\$\s*25,25/);

      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      await preencherItem(dialog, 2, 'Areia', '3', '0,10');
      expect(within(dialog).getByText(/Total do item 2/).parentElement).toHaveTextContent(/R\$\s*0,30/);

      const total = within(dialog).getByText('Total da medição').parentElement as HTMLElement;
      expect(total).toHaveTextContent(/R\$\s*25,55/);
      expect(within(dialog).getByText(/o servidor recalcula/i)).toBeInTheDocument();
    });

    it('somas com centavos não acumulam erro de ponto flutuante (0,10 + 0,20)', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'A', '1', '0,10');
      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      await preencherItem(dialog, 2, 'B', '1', '0,20');

      expect(within(dialog).getByText('Total da medição').parentElement).toHaveTextContent(/R\$\s*0,30$/);
    });

    it('aceita até 200 itens: o botão de adicionar trava no limite', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const dialog = await abrir(user());

      const adicionar = within(dialog).getByRole('button', { name: 'Item' });
      for (let i = 1; i < 200; i += 1) fireEvent.click(adicionar);
      expect(within(dialog).getAllByLabelText(/^Descrição do item/)).toHaveLength(200);
      expect(adicionar).toBeDisabled();
    }, 60_000);
  });

  describe('validações no formulário', () => {
    it('formulário vazio não envia e aponta descrição e valor unitário', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await within(dialog).findByText(/Descrição: Informe a descrição\./)).toBeInTheDocument();
      expect(within(dialog).getByText(/Valor unitário: Informe o valor unitário/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Descrição do item 1')).toHaveAttribute('aria-invalid', 'true');
      expect(post.enviados).toHaveLength(0);
    });

    it('número inválido (0 ou texto) e competência vazia são recusados', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.clear(within(dialog).getByLabelText('Número'));
      await u.type(within(dialog).getByLabelText('Número'), '0');
      definirCompetencia(dialog, '');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await within(dialog).findByText(/Informe o número da medição/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Informe a competência/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Número')).toHaveAttribute('aria-invalid', 'true');

      await u.clear(within(dialog).getByLabelText('Número'));
      await u.type(within(dialog).getByLabelText('Número'), 'abc');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      expect(await within(dialog).findByText(/Informe o número da medição/)).toBeInTheDocument();
      expect(post.enviados).toHaveLength(0);
    });

    it('quantidade deve ser maior que zero', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'Item', '0', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await within(dialog).findByText(/Quantidade: A quantidade deve ser maior que zero\./)).toBeInTheDocument();
      expect(post.enviados).toHaveLength(0);
    });

    it('valor unitário negativo é recusado, mas zero é aceito', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'Item', '1', '-5');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      expect(await within(dialog).findByText(/Valor unitário: Informe o valor unitário/)).toBeInTheDocument();
      expect(post.enviados).toHaveLength(0);

      await preencherItem(dialog, 1, 'Item', '1', '0');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      await waitFor(() => expect(post.enviados).toHaveLength(1));
      expect(post.enviados[0]?.itens).toEqual([
        { tipo: 'material', descricao: 'Item', quantidade: 1, valorUnitario: 0 },
      ]);
    });

    it('mais de 2 casas decimais em quantidade ou valor é recusado', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'Item', '1,234', '10,123');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await within(dialog).findByText(/Quantidade: Informe a quantidade \(até 2 casas/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Valor unitário: Informe o valor unitário \(até 2 casas/)).toBeInTheDocument();
      expect(post.enviados).toHaveLength(0);
    });

    it('descrição com mais de 255 caracteres é recusada; com 255 é aceita', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await preencherItem(dialog, 1, 'x', '1', '10');
      fireEvent.change(within(dialog).getByLabelText('Descrição do item 1'), { target: { value: 'a'.repeat(256) } });
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      expect(await within(dialog).findByText(/no máximo 255 caracteres/)).toBeInTheDocument();
      expect(post.enviados).toHaveLength(0);

      fireEvent.change(within(dialog).getByLabelText('Descrição do item 1'), { target: { value: 'a'.repeat(255) } });
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      await waitFor(() => expect(post.enviados).toHaveLength(1));
    });

    it('o campo de descrição não deixa digitar além de 255 caracteres', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]));
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await u.click(within(dialog).getByLabelText('Descrição do item 1'));
      await u.paste('b'.repeat(300));
      expect((within(dialog).getByLabelText('Descrição do item 1') as HTMLInputElement).value).toHaveLength(255);
    });
  });

  describe('envio', () => {
    it('envia o corpo no formato do backend: enums snake_case, competência dia 1, etapaId null, sem totais', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      definirCompetencia(dialog, '2026-09');
      await preencherItem(dialog, 1, '  Pedreiro  ', '2,5', '10,10');
      await u.selectOptions(within(dialog).getByLabelText('Tipo do item 1'), 'Mão de obra');
      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      await preencherItem(dialog, 2, 'Cimento', '3', '40');
      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      await preencherItem(dialog, 3, 'Betoneira', '1', '150.5');
      await u.selectOptions(within(dialog).getByLabelText('Tipo do item 3'), 'Equipamento');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      await waitFor(() => expect(post.enviados).toHaveLength(1));
      expect(post.enviados[0]).toEqual({
        obraId: OBRA_ID,
        etapaId: null,
        numero: 4,
        competencia: '2026-09-01',
        itens: [
          { tipo: 'mao_de_obra', descricao: 'Pedreiro', quantidade: 2.5, valorUnitario: 10.1 },
          { tipo: 'material', descricao: 'Cimento', quantidade: 3, valorUnitario: 40 },
          { tipo: 'equipamento', descricao: 'Betoneira', quantidade: 1, valorUnitario: 150.5 },
        ],
      });
      expect(JSON.stringify(post.enviados[0])).not.toMatch(/total/i);
    });

    it('com etapa escolhida envia o etapaId; o número editado vai como inteiro', async () => {
      const post = postMedicao();
      server.use(
        resumoApi(TRES).handler,
        etapasApi([
          { id: 'e1', nome: 'Fundação' },
          { id: 'e2', nome: 'Alvenaria' },
        ]),
        post.handler,
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      await within(dialog).findByRole('option', { name: 'Alvenaria' });
      await u.selectOptions(within(dialog).getByLabelText('Etapa (opcional)'), 'Alvenaria');
      await u.clear(within(dialog).getByLabelText('Número'));
      await u.type(within(dialog).getByLabelText('Número'), '10');
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      await waitFor(() => expect(post.enviados).toHaveLength(1));
      expect(post.enviados[0]?.etapaId).toBe('e2');
      expect(post.enviados[0]?.numero).toBe(10);
    });

    it('envia o token no cabeçalho Authorization', async () => {
      let auth: string | null = null;
      server.use(
        resumoApi(TRES).handler,
        etapasApi([]),
        http.post(`${API}/medicoes`, ({ request }) => {
          auth = request.headers.get('authorization');
          return HttpResponse.json(medicao({ numero: 4 }), { status: 201 });
        }),
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      await waitFor(() => expect(auth).toMatch(/^Bearer .+/));
    });

    it('sucesso fecha o diálogo, mostra aviso e atualiza a lista e os KPIs', async () => {
      const api = resumoApi(TRES);
      server.use(
        api.handler,
        etapasApi([]),
        http.post(`${API}/medicoes`, () => {
          api.definir([resumo({ id: 'novo', numero: 4, valorTotal: 77 }), ...TRES]);
          return HttpResponse.json(medicao({ id: 'novo', numero: 4 }), { status: 201 });
        }),
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'Item', '1', '77');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByRole('status')).toHaveTextContent('Medição 4 criada.');
      expect(await screen.findByRole('link', { name: 'Abrir medição 4' })).toBeInTheDocument();
      await waitFor(() => expect(KPI('Total de medições')).toHaveTextContent('4'));
      expect(KPI('Aguardando aprovação')).toHaveTextContent('2');
    });

    it('depois de criar, volta ao filtro "Todos os status" para a nova medição aparecer', async () => {
      const api = resumoApi(TRES);
      server.use(
        api.handler,
        etapasApi([]),
        http.post(`${API}/medicoes`, () => {
          api.definir([resumo({ id: 'novo', numero: 4 }), ...TRES]);
          return HttpResponse.json(medicao({ numero: 4 }), { status: 201 });
        }),
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      await screen.findByRole('table');
      await u.selectOptions(screen.getByLabelText('Filtrar por status'), 'NF emitida');
      await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));

      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await screen.findByRole('link', { name: 'Abrir medição 4' })).toBeInTheDocument();
      expect(screen.getByLabelText('Filtrar por status')).toHaveValue('');
    });

    it('lista vazia: criar a primeira medição leva à tabela', async () => {
      const api = resumoApi([]);
      server.use(
        api.handler,
        etapasApi([]),
        http.post(`${API}/medicoes`, () => {
          api.definir([resumo({ id: 'novo', numero: 1 })]);
          return HttpResponse.json(medicao({ numero: 1 }), { status: 201 });
        }),
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await screen.findByRole('link', { name: 'Abrir medição 1' })).toBeInTheDocument();
      expect(screen.queryByText('Nenhuma medição foi criada nesta obra ainda.')).not.toBeInTheDocument();
    });

    it('durante o envio os botões ficam desabilitados (sem duplo envio)', async () => {
      let liberar: () => void = () => {};
      const trava = new Promise<void>((r) => {
        liberar = r;
      });
      let posts = 0;
      server.use(
        resumoApi(TRES).handler,
        etapasApi([]),
        http.post(`${API}/medicoes`, async () => {
          posts += 1;
          await trava;
          return HttpResponse.json(medicao({ numero: 4 }), { status: 201 });
        }),
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      const salvando = await within(dialog).findByRole('button', { name: 'Salvando…' });
      expect(salvando).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      liberar();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(posts).toBe(1);
    });
  });

  describe('erros do servidor', () => {
    const enviarValido = async (u: ReturnType<typeof user>) => {
      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      return dialog;
    };

    it('400 "Itens[0].Tipo" aparece na linha do item, com o campo marcado como inválido', async () => {
      const post = postMedicao({ status: 400, body: { errors: { 'Itens[0].Tipo': ['Tipo de item inválido.'] } } });
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const dialog = await enviarValido(user());

      expect(await within(dialog).findByText(/Tipo: Tipo de item inválido\./)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Tipo do item 1')).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(dialog).toBeInTheDocument();
    });

    it('400 em item de índice maior cai na linha certa', async () => {
      const post = postMedicao({
        status: 400,
        body: { errors: { 'Itens[1].Quantidade': ['Quantidade inválida.'] } },
      });
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);
      await preencherItem(dialog, 1, 'A', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Item' }));
      await preencherItem(dialog, 2, 'B', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      expect(await within(dialog).findByText(/Quantidade: Quantidade inválida\./)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Quantidade do item 2')).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).getByLabelText('Quantidade do item 1')).toHaveAttribute('aria-invalid', 'false');
    });

    it('400 "Numero" e "EtapaId" vão para o campo respectivo', async () => {
      const post = postMedicao({
        status: 400,
        body: { errors: { Numero: ['Número inválido.'], EtapaId: ['Etapa não pertence à obra.'] } },
      });
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const dialog = await enviarValido(user());

      expect(await within(dialog).findByLabelText('Número')).toHaveAccessibleDescription('Número inválido.');
      expect(within(dialog).getByLabelText('Etapa (opcional)')).toHaveAccessibleDescription(
        'Etapa não pertence à obra.',
      );
    });

    it('409 (número repetido) aparece no campo número, com a mensagem do servidor', async () => {
      const post = postMedicao({ status: 409, body: { message: 'Já existe a medição 4 nesta obra.' } });
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const dialog = await enviarValido(user());

      const campo = await within(dialog).findByLabelText('Número');
      await waitFor(() => expect(campo).toHaveAccessibleDescription('Já existe a medição 4 nesta obra.'));
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('403 mostra alerta de sem permissão e mantém o diálogo aberto', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]), postMedicao({ status: 403, body: {} }).handler);
      renderApp(LISTA, 'Admin');
      const dialog = await enviarValido(user());

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/não tem permissão/i);
      expect(dialog).toBeInTheDocument();
    });

    it('404 (obra não encontrada) mostra alerta', async () => {
      server.use(resumoApi(TRES).handler, etapasApi([]), postMedicao({ status: 404, body: {} }).handler);
      renderApp(LISTA, 'Admin');
      const dialog = await enviarValido(user());

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/obra não foi encontrada/i);
    });

    it('500 mostra alerta com o código de suporte (requestId) e permite tentar de novo', async () => {
      const post = postMedicao({ status: 500, body: { requestId: 'req-criar-500', message: 'Erro interno.' } });
      server.use(resumoApi(TRES).handler, etapasApi([]), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await enviarValido(u);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('req-criar-500');
      expect(within(dialog).getByRole('button', { name: 'Criar medição' })).toBeEnabled();
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      await waitFor(() => expect(post.enviados).toHaveLength(2));
    });

    it('um erro novo substitui o alerta anterior e o envio seguinte limpa o aviso', async () => {
      let tentativa = 0;
      server.use(
        resumoApi(TRES).handler,
        etapasApi([]),
        http.post(`${API}/medicoes`, () => {
          tentativa += 1;
          if (tentativa === 1) {
            return HttpResponse.json({ requestId: 'req-1', message: 'Erro interno.' }, { status: 500 });
          }
          return HttpResponse.json(medicao({ numero: 4 }), { status: 201 });
        }),
      );
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await enviarValido(u);
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('req-1');

      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.queryByText(/req-1/)).not.toBeInTheDocument();
    });
  });

  describe('etapas', () => {
    it('lista as etapas da obra no seletor, com "Sem etapa" como padrão', async () => {
      server.use(
        resumoApi(TRES).handler,
        etapasApi([
          { id: 'e1', nome: 'Fundação' },
          { id: 'e2', nome: 'Alvenaria' },
        ]),
      );
      renderApp(LISTA, 'Admin');
      const dialog = await abrir(user());

      expect(await within(dialog).findByRole('option', { name: 'Fundação' })).toBeInTheDocument();
      expect(within(dialog).getByRole('option', { name: 'Sem etapa' })).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Etapa (opcional)')).toHaveValue('');
    });

    it('falha ao carregar as etapas não bloqueia: avisa e a medição pode ser criada sem etapa', async () => {
      const post = postMedicao();
      server.use(resumoApi(TRES).handler, etapasComErro(), post.handler);
      renderApp(LISTA, 'Admin');
      const u = user();
      const dialog = await abrir(u);

      expect(await within(dialog).findByText(/Não foi possível carregar as etapas/)).toBeInTheDocument();
      await preencherItem(dialog, 1, 'Item', '1', '10');
      await u.click(within(dialog).getByRole('button', { name: 'Criar medição' }));

      await waitFor(() => expect(post.enviados).toHaveLength(1));
      expect(post.enviados[0]?.etapaId).toBeNull();
    });
  });
});
