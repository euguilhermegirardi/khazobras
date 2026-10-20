import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Medicao } from '@/interfaces/medicao';
import {
  APPROVER_ID,
  DETALHE,
  detalheApi,
  etapasApi,
  item,
  LISTA,
  medicao,
  OBRA_ID,
  OUTRA_OBRA_ID,
  resumoApi,
} from '@/test/medicoesAdmin';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();

const pendente = medicao({ id: 'm1', numero: 1 });
const aprovada = medicao({
  id: 'm2',
  numero: 2,
  status: 'Approved',
  approvedAt: '2026-09-25T15:00:00Z',
  etapaId: 'e1',
  competencia: '2026-09-01',
  valorTotal: 1105,
  itens: [
    item({
      id: 'i1',
      tipo: 'MaoDeObra',
      descricao: 'Pedreiro (diária)',
      quantidade: 5,
      valorUnitario: 150,
      valorTotal: 750,
    }),
    item({
      id: 'i2',
      tipo: 'Material',
      descricao: 'Cimento CP-II',
      quantidade: 10,
      valorUnitario: 35.5,
      valorTotal: 355,
    }),
  ],
});
const comNf = medicao({
  id: 'm3',
  numero: 3,
  status: 'InvoiceIssued',
  approvedAt: '2026-08-20T15:00:00Z',
  nfNumber: 'NF-2026-0042',
  nfIssuedAt: '2026-08-28T15:00:00Z',
});

const abrir = (m: Medicao) => {
  server.use(detalheApi(m), etapasApi([{ id: 'e1', nome: 'Fundação' }]));
  return renderApp(DETALHE(m.id), 'Admin');
};

describe('Medição (admin) - detalhe', () => {
  it('mostra carregando e depois competência, etapa pelo nome, valor, status e itens', async () => {
    abrir(aprovada);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando medição');
    expect(await screen.findByRole('heading', { name: 'Medição 2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Etapa: Fundação/)).toBeInTheDocument());
    expect(screen.getByText(/Competência: Setembro de 2026/)).toBeInTheDocument();

    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('Mão de obra')).toBeInTheDocument();
    expect(within(tabela).getByText('Pedreiro (diária)')).toBeInTheDocument();
    expect(within(tabela).getByText('Cimento CP-II')).toBeInTheDocument();
    expect(within(tabela).getAllByText(/R\$\s*1\.105,00/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Voltar para as medições/ })).toHaveAttribute(
      'href',
      `/admin/obras/${OBRA_ID}/medicoes`,
    );
  });

  it('medição sem etapa mostra "—" como etapa', async () => {
    abrir(pendente);
    expect(await screen.findByText(/Etapa: —/)).toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    server.use(
      etapasApi([]),
      http.get(`${API}/medicoes/m1`, () =>
        HttpResponse.json({ requestId: 'req-det-500', message: 'Erro interno do servidor.' }, { status: 500 }),
      ),
    );
    renderApp(DETALHE('m1'), 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-det-500');
    server.use(detalheApi(pendente));
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Medição 1' })).toBeInTheDocument();
  });

  it('403 mostra sem permissão e nenhum item', async () => {
    server.use(
      etapasApi([]),
      http.get(`${API}/medicoes/m1`, () => HttpResponse.json({}, { status: 403 })),
    );
    renderApp(DETALHE('m1'), 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('404 mostra "não encontrado" com opção de voltar', async () => {
    server.use(
      etapasApi([]),
      http.get(`${API}/medicoes/m1`, () => HttpResponse.json({}, { status: 404 })),
    );
    renderApp(DETALHE('m1'), 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não encontrad/i);
    expect(screen.getByRole('link', { name: /Voltar para as medições/ })).toBeInTheDocument();
  });

  it('falha ao carregar as etapas não derruba o detalhe', async () => {
    server.use(
      detalheApi(aprovada),
      http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
    );
    renderApp(DETALHE('m2'), 'Admin');

    expect(await screen.findByRole('heading', { name: 'Medição 2' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Etapa: não identificada/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Emitir NF' })).toBeInTheDocument();
  });

  it('medição sem itens ainda renderiza sem quebrar', async () => {
    abrir({ ...pendente, itens: [], valorTotal: 0 });
    expect(await screen.findByRole('heading', { name: 'Medição 1' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('medição de outra obra na URL é tratada como não encontrada e nada dela aparece', async () => {
    const alheia = medicao({
      id: 'z9',
      obraId: OUTRA_OBRA_ID,
      numero: 9,
      status: 'Approved',
      itens: [item({ descricao: 'Item secreto da outra obra' })],
    });
    abrir(alheia);

    expect(await screen.findByText('Medição não encontrada nesta obra.')).toBeInTheDocument();
    expect(screen.queryByText('Item secreto da outra obra')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emitir NF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('nunca exibe o id interno de quem aprovou (approvedByUserId) em nenhum status', async () => {
    for (const m of [pendente, aprovada, comNf]) {
      const { unmount } = abrir(m);
      await screen.findByRole('heading', { name: `Medição ${m.numero}` });
      expect(document.body.innerHTML).not.toContain(APPROVER_ID);
      expect(screen.queryByText(/77777777/)).not.toBeInTheDocument();
      unmount();
      server.resetHandlers();
    }
  });

  it('não exibe custo real nem margem', async () => {
    abrir(aprovada);
    await screen.findByRole('heading', { name: 'Medição 2' });
    expect(screen.queryByText(/custo real|margem|rentabilidade/i)).not.toBeInTheDocument();
  });

  describe('ação por status', () => {
    it('PendingApproval: sem botão de emitir NF nem de aprovar (admin não aprova) e avisa que aguarda o cliente', async () => {
      abrir(pendente);
      await screen.findByRole('heading', { name: 'Medição 1' });

      expect(screen.queryByRole('button', { name: /emitir nf/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
      expect(screen.getAllByText(/Aguardando aprovação do cliente/).length).toBeGreaterThan(0);
      expect(screen.getByText(/só é liberada depois que o cliente aprovar/i)).toBeInTheDocument();
    });

    it('Approved: mostra a data da aprovação, o botão "Emitir NF" e nenhum botão de aprovar', async () => {
      abrir(aprovada);
      await screen.findByRole('heading', { name: 'Medição 2' });

      expect(screen.getByRole('button', { name: 'Emitir NF' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Aprovada pelo cliente em 25\/09\/2026/)).toBeInTheDocument();
    });

    it('InvoiceIssued: mostra o número e a data da NF e nenhuma ação de escrita', async () => {
      abrir(comNf);
      await screen.findByRole('heading', { name: 'Medição 3' });

      expect(screen.getByText(/NF nº NF-2026-0042, emitida em 28\/08\/2026/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /emitir nf|aprovar|editar|excluir/i })).not.toBeInTheDocument();
    });

    it('InvoiceIssued sem número de NF não quebra', async () => {
      abrir({ ...comNf, nfNumber: null, nfIssuedAt: null });
      await screen.findByRole('heading', { name: 'Medição 3' });
      expect(screen.getByText(/NF emitida/, { selector: 'p' })).toBeInTheDocument();
    });

    it('Master também vê o botão em medição aprovada', async () => {
      server.use(detalheApi(aprovada), etapasApi([]));
      renderApp(DETALHE('m2'), 'Master');
      expect(await screen.findByRole('button', { name: 'Emitir NF' })).toBeInTheDocument();
    });
  });
});

describe('Medição (admin) - emitir NF', () => {
  const abrirDialog = async (m: Medicao = aprovada) => {
    abrir(m);
    const u = user();
    await u.click(await screen.findByRole('button', { name: 'Emitir NF' }));
    const dialog = await screen.findByRole('dialog', { name: 'Emitir NF' });
    return { u, dialog };
  };

  /** POST issue-invoice que guarda o corpo; após o sucesso o GET passa a devolver a medição com NF. */
  const postNf = (resposta?: { status: number; body: unknown }, base: Medicao = aprovada) => {
    const enviados: Record<string, unknown>[] = [];
    let atual = base;
    const handlers = [
      http.get(`${API}/medicoes/${base.id}`, () => HttpResponse.json({ ...atual, approvedByUserId: APPROVER_ID })),
      http.post(`${API}/medicoes/${base.id}/issue-invoice`, async ({ request }) => {
        const body = (await request.json()) as { nfNumber: string };
        enviados.push(body);
        if (resposta) return HttpResponse.json(resposta.body as never, { status: resposta.status });
        atual = { ...base, status: 'InvoiceIssued', nfNumber: body.nfNumber, nfIssuedAt: '2026-10-19T15:00:00Z' };
        return HttpResponse.json({ ...atual, approvedByUserId: APPROVER_ID });
      }),
    ];
    return { handlers, enviados };
  };

  const preparar = async (resposta?: { status: number; body: unknown }) => {
    const api = postNf(resposta);
    server.use(...api.handlers, etapasApi([]));
    renderApp(DETALHE(aprovada.id), 'Admin');
    const u = user();
    await u.click(await screen.findByRole('button', { name: 'Emitir NF' }));
    const dialog = await screen.findByRole('dialog', { name: 'Emitir NF' });
    return { ...api, u, dialog };
  };

  it('abre o diálogo com o número da medição e o campo da NF vazio', async () => {
    const { dialog } = await abrirDialog();
    expect(within(dialog).getByText(/medição 2/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Número da NF')).toHaveValue('');
  });

  it('Cancelar fecha sem enviar', async () => {
    const api = postNf();
    server.use(...api.handlers, etapasApi([]));
    renderApp(DETALHE(aprovada.id), 'Admin');
    const u = user();
    await u.click(await screen.findByRole('button', { name: 'Emitir NF' }));
    const dialog = await screen.findByRole('dialog', { name: 'Emitir NF' });
    await u.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.enviados).toHaveLength(0);
  });

  describe('validações', () => {
    it('número vazio ou só espaços é recusado e nada é enviado', async () => {
      const { u, dialog, enviados } = await preparar();

      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));
      expect(await within(dialog).findByText('Informe o número da nota fiscal.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Número da NF')).toHaveAttribute('aria-invalid', 'true');

      await u.type(within(dialog).getByLabelText('Número da NF'), '   ');
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));
      expect(await within(dialog).findByText('Informe o número da nota fiscal.')).toBeInTheDocument();
      expect(enviados).toHaveLength(0);
    });

    it('mais de 50 caracteres é recusado; com exatamente 50 é aceito', async () => {
      const { u, dialog, enviados } = await preparar();

      fireEvent.change(within(dialog).getByLabelText('Número da NF'), { target: { value: '9'.repeat(51) } });
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));
      expect(await within(dialog).findByText(/no máximo 50 caracteres/)).toBeInTheDocument();
      expect(enviados).toHaveLength(0);

      fireEvent.change(within(dialog).getByLabelText('Número da NF'), { target: { value: '9'.repeat(50) } });
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));
      await waitFor(() => expect(enviados).toHaveLength(1));
    });

    it('o campo não deixa digitar além de 50 caracteres', async () => {
      const { u, dialog } = await preparar();
      await u.type(within(dialog).getByLabelText('Número da NF'), '1'.repeat(70));
      expect((within(dialog).getByLabelText('Número da NF') as HTMLInputElement).value).toHaveLength(50);
    });

    it('caracteres de controle são recusados', async () => {
      const { u, dialog, enviados } = await preparar();

      fireEvent.change(within(dialog).getByLabelText('Número da NF'), { target: { value: 'NF\u0007123' } });
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));

      expect(await within(dialog).findByText(/caracteres inválidos/)).toBeInTheDocument();
      expect(enviados).toHaveLength(0);
    });

    it('espaços nas pontas são removidos antes de enviar', async () => {
      const { u, dialog, enviados } = await preparar();

      await u.type(within(dialog).getByLabelText('Número da NF'), '  NF-123  ');
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));

      await waitFor(() => expect(enviados).toEqual([{ nfNumber: 'NF-123' }]));
    });
  });

  describe('envio', () => {
    it('sucesso fecha o diálogo, avisa e a tela passa a mostrar a NF sem o botão de emitir', async () => {
      const { u, dialog, enviados } = await preparar();

      await u.type(within(dialog).getByLabelText('Número da NF'), 'NF-2026-0100');
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(enviados).toEqual([{ nfNumber: 'NF-2026-0100' }]);
      expect(await screen.findByText('NF NF-2026-0100 emitida.')).toBeInTheDocument();
      expect(await screen.findByText(/NF nº NF-2026-0100, emitida em 19\/10\/2026/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Emitir NF' })).not.toBeInTheDocument();
    });

    it('envia o token no cabeçalho Authorization', async () => {
      let auth: string | null = null;
      server.use(
        detalheApi(aprovada),
        etapasApi([]),
        http.post(`${API}/medicoes/m2/issue-invoice`, ({ request }) => {
          auth = request.headers.get('authorization');
          return HttpResponse.json({ ...aprovada, status: 'InvoiceIssued', nfNumber: 'N1' });
        }),
      );
      renderApp(DETALHE('m2'), 'Admin');
      const u = user();
      await u.click(await screen.findByRole('button', { name: 'Emitir NF' }));
      const dialog = await screen.findByRole('dialog', { name: 'Emitir NF' });
      await u.type(within(dialog).getByLabelText('Número da NF'), 'N1');
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));

      await waitFor(() => expect(auth).toMatch(/^Bearer .+/));
    });

    it('durante o envio os botões ficam desabilitados', async () => {
      let liberar: () => void = () => {};
      const trava = new Promise<void>((r) => {
        liberar = r;
      });
      let posts = 0;
      server.use(
        detalheApi(aprovada),
        etapasApi([]),
        http.post(`${API}/medicoes/m2/issue-invoice`, async () => {
          posts += 1;
          await trava;
          return HttpResponse.json({ ...aprovada, status: 'InvoiceIssued', nfNumber: 'N1' });
        }),
      );
      renderApp(DETALHE('m2'), 'Admin');
      const u = user();
      await u.click(await screen.findByRole('button', { name: 'Emitir NF' }));
      const dialog = await screen.findByRole('dialog', { name: 'Emitir NF' });
      await u.type(within(dialog).getByLabelText('Número da NF'), 'N1');
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));

      expect(await within(dialog).findByRole('button', { name: 'Emitindo…' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      liberar();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(posts).toBe(1);
    });
  });

  describe('erros do servidor', () => {
    const enviar = async (resposta: { status: number; body: unknown }) => {
      const ctx = await preparar(resposta);
      await ctx.u.type(within(ctx.dialog).getByLabelText('Número da NF'), 'NF-1');
      await ctx.u.click(within(ctx.dialog).getByRole('button', { name: 'Emitir NF' }));
      return ctx;
    };

    it('400 NfNumber aparece no campo, sem alerta geral, e o diálogo continua aberto', async () => {
      const { dialog } = await enviar({ status: 400, body: { errors: { NfNumber: ['Número de NF inválido.'] } } });

      const campo = within(dialog).getByLabelText('Número da NF');
      await waitFor(() => expect(campo).toHaveAccessibleDescription('Número de NF inválido.'));
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('409 mostra a mensagem do servidor em alerta e a tela recarrega o estado real', async () => {
      const { dialog } = await enviar({ status: 409, body: { message: 'A medição não está aprovada.' } });

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('A medição não está aprovada.');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('409 porque outro admin já emitiu: a tela atualiza para o estado do servidor', async () => {
      const base = aprovada;
      let jaEmitida = false;
      server.use(
        etapasApi([]),
        http.get(`${API}/medicoes/m2`, () =>
          HttpResponse.json(jaEmitida ? { ...base, status: 'InvoiceIssued', nfNumber: 'NF-OUTRO' } : base),
        ),
        http.post(`${API}/medicoes/m2/issue-invoice`, () => {
          jaEmitida = true;
          return HttpResponse.json({ message: 'A medição já teve a NF emitida.' }, { status: 409 });
        }),
      );
      renderApp(DETALHE('m2'), 'Admin');
      const u = user();
      await u.click(await screen.findByRole('button', { name: 'Emitir NF' }));
      const dialog = await screen.findByRole('dialog', { name: 'Emitir NF' });
      await u.type(within(dialog).getByLabelText('Número da NF'), 'NF-1');
      await u.click(within(dialog).getByRole('button', { name: 'Emitir NF' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('já teve a NF emitida');
      await u.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      expect(await screen.findByText(/NF nº NF-OUTRO/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Emitir NF' })).not.toBeInTheDocument();
    });

    it('403 mostra alerta de sem permissão', async () => {
      const { dialog } = await enviar({ status: 403, body: {} });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    });

    it('404 mostra alerta de medição não encontrada', async () => {
      const { dialog } = await enviar({ status: 404, body: {} });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/medição não foi encontrada/i);
    });

    it('500 mostra alerta com o código de suporte (requestId)', async () => {
      const { dialog } = await enviar({ status: 500, body: { requestId: 'req-nf-500', message: 'Erro interno.' } });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('req-nf-500');
      expect(within(dialog).getByRole('button', { name: 'Emitir NF' })).toBeEnabled();
    });
  });
});

describe('Medições (admin) - papel e guarda de rota', () => {
  const contar = () => {
    const chamadas: string[] = [];
    const registra = (rotulo: string) => () => {
      chamadas.push(rotulo);
      return HttpResponse.json([]);
    };
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/medicoes/resumo`, registra('resumo')),
      http.get(`${API}/medicoes/m1`, registra('detalhe')),
      http.get(`${API}/obras/${OBRA_ID}/etapas`, registra('etapas')),
    );
    return chamadas;
  };

  it.each([
    ['lista', LISTA],
    ['detalhe', DETALHE('m1')],
  ])('cliente em /admin (%s) vê "Sem permissão", nenhuma ação e nenhuma chamada à API', async (_nome, rota) => {
    const chamadas = contar();
    renderApp(rota, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nova medição|emitir nf|aprovar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(chamadas).toEqual([]);
  });

  it('deslogado é enviado ao login', async () => {
    const chamadas = contar();
    renderApp(LISTA);

    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(chamadas).toEqual([]);
  });

  it('a sidebar do admin tem "Medições" apontando para a lista da obra aberta', async () => {
    server.use(resumoApi([]).handler);
    renderApp(LISTA, 'Admin');

    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: 'Medições' })).toHaveAttribute('href', LISTA);
  });

  it('o item "Medições" fica ativo também no detalhe', async () => {
    abrir(aprovada);
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    await screen.findByRole('heading', { name: 'Medição 2' });
    expect(within(nav).getByRole('link', { name: 'Medições' })).toHaveAttribute('aria-current', 'page');
  });

  it('a sidebar do cliente não tem "Medições" (só "Fechamento")', async () => {
    server.use(http.get(`${API}/obras/${OBRA_ID}/medicoes`, () => HttpResponse.json([])));
    renderApp(`/cliente/obras/${OBRA_ID}/fechamento`, 'Client');

    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: 'Fechamento' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Medições' })).not.toBeInTheDocument();
  });

  describe('regressão do Fechamento do cliente', () => {
    const doCliente = (m: Medicao) => {
      // O backend não manda approvedByUserId ao cliente; se mandar (bug), a tela ainda não pode exibir.
      server.use(http.get(`${API}/medicoes/${m.id}`, () => HttpResponse.json({ ...m, approvedByUserId: APPROVER_ID })));
      return renderApp(`/cliente/obras/${OBRA_ID}/fechamento/${m.id}`, 'Client');
    };

    it('cliente não vê approvedByUserId nem ação de emitir NF (Approved)', async () => {
      doCliente(aprovada);
      await screen.findByRole('heading', { name: 'Medição 2' });

      expect(document.body.innerHTML).not.toContain(APPROVER_ID);
      expect(screen.queryByRole('button', { name: /emitir nf/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
    });

    it('cliente em medição pendente tem só a ação "Aprovar medição"', async () => {
      doCliente(pendente);
      await screen.findByRole('heading', { name: 'Medição 1' });

      expect(screen.getByRole('button', { name: /aprovar medição/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /emitir nf|criar|nova|editar|excluir/i })).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain(APPROVER_ID);
    });

    it('admin não entra no Fechamento do cliente (sem botão de aprovar)', async () => {
      server.use(http.get(`${API}/obras/${OBRA_ID}/medicoes`, () => HttpResponse.json([])));
      renderApp(`/cliente/obras/${OBRA_ID}/fechamento`, 'Admin');

      expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
    });
  });
});
