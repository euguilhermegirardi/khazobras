import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN,
  CLIENTE,
  contratoCliente,
  detalheHandler,
  erroNaLista,
  erroNoDetalhe,
  listaHandler,
  OBRA_ID,
  pagamentoCliente,
} from '@/test/contratos';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();

const umContrato = contratoCliente();
const quitado = contratoCliente({
  id: 'c1',
  numero: 'CT-2026/01',
  valorContratado: 100000,
  totalPago: 120000,
  saldoAPagar: -20000,
});
const emAndamento = contratoCliente({
  id: 'c2',
  numero: 'CT-2026/02',
  valorContratado: 50000,
  dataAssinatura: '2026-07-10',
  totalPago: 10000.5,
  saldoAPagar: 39999.5,
});

const card = (numero: string) => screen.getByRole('group', { name: `Contrato ${numero}` });
/** Valor (`dd`) de um rótulo (`dt`) do card. */
const valorDe = (el: HTMLElement, rotulo: string) => within(el).getByText(rotulo).nextElementSibling as HTMLElement;
/** Valor de um indicador (KPI) pelo rótulo. */
const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).nextElementSibling as HTMLElement;

describe('Contratos (cliente) - estados', () => {
  it('mostra carregando e depois o contrato com os valores, sem KPIs quando é um só', async () => {
    server.use(listaHandler([umContrato]), detalheHandler(umContrato, [pagamentoCliente()]));
    renderApp(CLIENTE, 'Client');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando contratos');
    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();

    const c = card('CT-2026/01');
    expect(c).toHaveTextContent('Assinado em 15/03/2026');
    expect(valorDe(c, 'Valor contratado')).toHaveTextContent(/R\$\s*100\.000,00/);
    expect(valorDe(c, 'Pago')).toHaveTextContent(/R\$\s*40\.000,00/);
    expect(valorDe(c, 'Saldo a pagar')).toHaveTextContent(/R\$\s*60\.000,00/);
    // Com um contrato só, os números já estão no card: nada de totais da obra.
    expect(screen.queryByText('Valor contratado total')).not.toBeInTheDocument();
    expect(screen.queryByText('Total pago')).not.toBeInTheDocument();
  });

  it('obra sem contrato mostra a mensagem de vazio', async () => {
    server.use(listaHandler([]));
    renderApp(CLIENTE, 'Client');

    expect(await screen.findByText('Nenhum contrato registrado para esta obra')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    server.use(erroNaLista(500, { requestId: 'req-contratos-500', message: 'Erro interno do servidor.' }));
    renderApp(CLIENTE, 'Client');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-contratos-500');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    server.use(listaHandler([umContrato]), detalheHandler(umContrato, []));
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
  });

  it('cliente de outra obra (403) vê "sem permissão" e nenhum contrato', async () => {
    server.use(erroNaLista(403));
    renderApp(CLIENTE, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('contrato sem data de assinatura avisa que não foi informada', async () => {
    const semData = contratoCliente({ dataAssinatura: null });
    server.use(listaHandler([semData]), detalheHandler(semData, []));
    renderApp(CLIENTE, 'Client');

    await screen.findByRole('heading', { name: 'Contrato CT-2026/01' });
    expect(card('CT-2026/01')).toHaveTextContent('Data de assinatura não informada');
  });
});

describe('Contratos (cliente) - vários contratos e saldo', () => {
  const abrirDois = () => {
    server.use(
      listaHandler([quitado, emAndamento]),
      detalheHandler(quitado, [pagamentoCliente({ valor: 120000 })]),
      detalheHandler(emAndamento, [pagamentoCliente({ id: 'p2', valor: 10000.5 })]),
    );
    return renderApp(CLIENTE, 'Client');
  };

  it('com 2 contratos mostra os totais da obra (soma dos contratos)', async () => {
    abrirDois();
    await screen.findByRole('heading', { name: 'Contrato CT-2026/02' });

    expect(kpi('Valor contratado total')).toHaveTextContent(/R\$\s*150\.000,00/);
    expect(kpi('Total pago')).toHaveTextContent(/R\$\s*130\.000,50/);
    // -20.000,00 + 39.999,50 = 19.999,50 (ainda a pagar)
    expect(kpi('Saldo a pagar')).toHaveTextContent(/R\$\s*19\.999,50/);
  });

  it('contrato pago a mais mostra "Pago a mais" com o valor sem sinal', async () => {
    abrirDois();
    await screen.findByRole('heading', { name: 'Contrato CT-2026/01' });

    const c = card('CT-2026/01');
    expect(within(c).queryByText('Saldo a pagar')).not.toBeInTheDocument();
    const aMais = valorDe(c, 'Pago a mais');
    expect(aMais).toHaveTextContent(/^R\$\s*20\.000,00$/);
    expect(aMais.textContent).not.toContain('-');
    expect(aMais.textContent).not.toContain('−');
    // O outro contrato continua com saldo a pagar.
    expect(valorDe(card('CT-2026/02'), 'Saldo a pagar')).toHaveTextContent(/R\$\s*39\.999,50/);
  });

  it('total da obra pago a mais mostra "Pago a mais" também no indicador, sem sinal', async () => {
    const a = contratoCliente({ id: 'c1', numero: 'A', valorContratado: 1000, totalPago: 1500, saldoAPagar: -500 });
    const b = contratoCliente({ id: 'c2', numero: 'B', valorContratado: 1000, totalPago: 1200, saldoAPagar: -200 });
    server.use(listaHandler([a, b]), detalheHandler(a, []), detalheHandler(b, []));
    renderApp(CLIENTE, 'Client');
    await screen.findByRole('heading', { name: 'Contrato B' });

    expect(kpi('Pago a mais')).toHaveTextContent(/^R\$\s*700,00$/);
    expect(screen.queryByText('Saldo a pagar', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('a barra de progresso nunca mostra 100% com saldo em aberto (99,6% vira 99%)', async () => {
    const quase = contratoCliente({ id: 'c1', valorContratado: 1000, totalPago: 996, saldoAPagar: 4 });
    const pago = contratoCliente({
      id: 'c2',
      numero: 'CT-2026/02',
      valorContratado: 1000,
      totalPago: 1000,
      saldoAPagar: 0,
    });
    server.use(listaHandler([quase, pago]), detalheHandler(quase, []), detalheHandler(pago, []));
    renderApp(CLIENTE, 'Client');
    await screen.findByRole('heading', { name: 'Contrato CT-2026/02' });

    const barraQuase = within(card('CT-2026/01')).getByRole('progressbar', { name: 'Pago do contrato CT-2026/01' });
    expect(barraQuase).toHaveAttribute('aria-valuenow', '99');
    expect(card('CT-2026/01')).toHaveTextContent('99%');
    const barraPago = within(card('CT-2026/02')).getByRole('progressbar', { name: 'Pago do contrato CT-2026/02' });
    expect(barraPago).toHaveAttribute('aria-valuenow', '100');
  });

  it('pago a mais também fecha a barra em 100%', async () => {
    abrirDois();
    await screen.findByRole('heading', { name: 'Contrato CT-2026/01' });
    expect(within(card('CT-2026/01')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(within(card('CT-2026/02')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  });
});

describe('Contratos (cliente) - pagamentos', () => {
  it('lista pagamentos com e sem medição: "Medição nº N" ou "—", e a data como dd/mm/aaaa', async () => {
    server.use(
      listaHandler([umContrato]),
      detalheHandler(umContrato, [
        pagamentoCliente({
          id: 'p1',
          valor: 2500.5,
          dataPagamento: '2026-06-01',
          formaPagamento: 'TED',
          referenteMedicaoId: 'm3',
          referenteMedicaoNumero: 3,
        }),
        pagamentoCliente({
          id: 'p2',
          valor: 3000,
          dataPagamento: '2026-04-01',
          formaPagamento: null,
          referenteMedicaoId: null,
          referenteMedicaoNumero: null,
        }),
      ]),
    );
    renderApp(CLIENTE, 'Client');

    const secao = await screen.findByRole('region', { name: 'Pagamentos do contrato CT-2026/01' });
    const tabela = await within(secao).findByRole('table');
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3); // cabeçalho + 2
    const [l1, l2] = [linhas[1] as HTMLElement, linhas[2] as HTMLElement];
    expect(l1).toHaveTextContent('01/06/2026');
    expect(l1).toHaveTextContent(/R\$\s*2\.500,50/);
    expect(l1).toHaveTextContent('TED');
    expect(l1).toHaveTextContent('Medição nº 3');
    expect(l2).toHaveTextContent('01/04/2026');
    expect(l2).toHaveTextContent(/R\$\s*3\.000,00/);
    // Forma e medição ausentes: "—" nas duas células.
    expect(within(l2).getAllByText('—')).toHaveLength(2);
    expect(l2).not.toHaveTextContent('Medição nº');
  });

  it('as datas não recuam um dia no fuso de São Paulo (UTC-3)', async () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
    try {
      // Pré-condição: neste fuso, `new Date("2026-10-13")` (UTC) cairia no dia 12. A tela não pode cair nessa armadilha.
      expect(new Date('2026-10-13').getDate()).toBe(12);
      const c = contratoCliente({ dataAssinatura: '2026-01-01' });
      server.use(
        listaHandler([c]),
        detalheHandler(c, [
          pagamentoCliente({ id: 'p1', dataPagamento: '2026-10-13' }),
          pagamentoCliente({ id: 'p2', dataPagamento: '2025-12-31' }),
          pagamentoCliente({ id: 'p3', dataPagamento: '2026-03-01' }),
        ]),
      );
      renderApp(CLIENTE, 'Client');

      const tabela = await screen.findByRole('table');
      expect(card('CT-2026/01')).toHaveTextContent('Assinado em 01/01/2026');
      expect(tabela).toHaveTextContent('13/10/2026');
      expect(tabela).toHaveTextContent('31/12/2025');
      expect(tabela).toHaveTextContent('01/03/2026');
      expect(tabela).not.toHaveTextContent('12/10/2026');
      expect(tabela).not.toHaveTextContent('30/12/2025');
      expect(tabela).not.toHaveTextContent('28/02/2026');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('contrato sem pagamentos mostra o vazio só naquele card', async () => {
    server.use(
      listaHandler([quitado, emAndamento]),
      detalheHandler(quitado, []),
      detalheHandler(emAndamento, [pagamentoCliente()]),
    );
    renderApp(CLIENTE, 'Client');

    const vazio = await screen.findByRole('region', { name: 'Pagamentos do contrato CT-2026/01' });
    expect(await within(vazio).findByText('Nenhum pagamento registrado neste contrato ainda.')).toBeInTheDocument();
    const cheio = screen.getByRole('region', { name: 'Pagamentos do contrato CT-2026/02' });
    expect(await within(cheio).findByRole('table')).toBeInTheDocument();
  });

  it('o detalhe carrega por card: carregando num, tabela no outro, página intacta', async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      listaHandler([quitado, emAndamento]),
      detalheHandler(quitado, [pagamentoCliente()]),
      http.get(`${API}/contratos/c2`, async () => {
        await espera;
        return HttpResponse.json({ ...emAndamento, pagamentos: [pagamentoCliente({ id: 'p2', valor: 10000.5 })] });
      }),
    );
    renderApp(CLIENTE, 'Client');

    const secao2 = await screen.findByRole('region', { name: 'Pagamentos do contrato CT-2026/02' });
    expect(within(secao2).getByRole('status')).toHaveTextContent('Carregando pagamentos');
    const secao1 = screen.getByRole('region', { name: 'Pagamentos do contrato CT-2026/01' });
    expect(await within(secao1).findByRole('table')).toBeInTheDocument();
    // O card carregando já mostra os números do contrato.
    expect(valorDe(card('CT-2026/02'), 'Valor contratado')).toHaveTextContent(/R\$\s*50\.000,00/);

    liberar();
    expect(await within(secao2).findByRole('table')).toBeInTheDocument();
    expect(within(secao2).queryByRole('status')).not.toBeInTheDocument();
  });

  it('erro 500 no detalhe de um contrato mostra o código só naquele card e permite tentar de novo', async () => {
    server.use(
      listaHandler([quitado, emAndamento]),
      detalheHandler(quitado, [pagamentoCliente()]),
      erroNoDetalhe('c2', 500, { requestId: 'req-detalhe-500', message: 'Erro interno do servidor.' }),
    );
    renderApp(CLIENTE, 'Client');

    const secao2 = await screen.findByRole('region', { name: 'Pagamentos do contrato CT-2026/02' });
    const alerta = await within(secao2).findByRole('alert');
    expect(alerta).toHaveTextContent('req-detalhe-500');
    // A página e o outro contrato seguem de pé.
    expect(screen.getByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contrato CT-2026/02' })).toBeInTheDocument();
    const secao1 = screen.getByRole('region', { name: 'Pagamentos do contrato CT-2026/01' });
    expect(await within(secao1).findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    server.use(detalheHandler(emAndamento, [pagamentoCliente({ id: 'p2', valor: 10000.5 })]));
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await within(secao2).findByRole('table')).toBeInTheDocument();
  });

  it('403 no detalhe de um contrato é tratado naquele card, sem derrubar a página', async () => {
    server.use(listaHandler([umContrato]), erroNoDetalhe('c1', 403));
    renderApp(CLIENTE, 'Client');

    const secao = await screen.findByRole('region', { name: 'Pagamentos do contrato CT-2026/01' });
    expect(await within(secao).findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.getByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
  });
});

describe('Contratos (cliente) - papel e dados internos', () => {
  it('é somente leitura: nenhum botão de criar, registrar, editar, excluir ou aprovar', async () => {
    server.use(
      listaHandler([quitado, emAndamento]),
      detalheHandler(quitado, [pagamentoCliente()]),
      detalheHandler(emAndamento, [pagamentoCliente({ id: 'p2' })]),
    );
    renderApp(CLIENTE, 'Client');
    await screen.findAllByRole('table');

    // Só o conteúdo da tela (o "Sair" do topbar é do shell).
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/novo contrato|registrar pagamento/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /novo|editar|excluir/i })).not.toBeInTheDocument();
  });

  it('nunca exibe createdAt, updatedAt, contratoId, storageKey, custo ou margem, mesmo que o servidor mande', async () => {
    const vazados = {
      createdAt: '2031-05-06T07:08:09Z',
      updatedAt: '2032-06-07T08:09:10Z',
      storageKey: 'contratos/segredo-123/contrato.pdf',
      custoReal: 987654.32,
      margem: 0.4321,
      margemLucro: 123456.78,
    };
    const vazando = { ...umContrato, ...vazados };
    server.use(
      listaHandler([vazando]),
      http.get(`${API}/contratos/c1`, () =>
        HttpResponse.json({
          ...vazando,
          pagamentos: [
            {
              ...pagamentoCliente(),
              contratoId: 'c1-contrato-interno',
              createdAt: '2033-07-08T09:10:11Z',
              custoReal: 555555.55,
            },
          ],
        }),
      ),
    );
    renderApp(CLIENTE, 'Client');
    await screen.findByRole('table');

    const html = document.body.innerHTML;
    for (const marcador of [
      '2031',
      '2032',
      '2033',
      'segredo-123',
      'contrato.pdf',
      '987.654',
      '987654',
      '0,4321',
      '123.456',
      '555.555',
      'c1-contrato-interno',
    ]) {
      expect(html, `não deveria conter "${marcador}"`).not.toContain(marcador);
    }
    expect(screen.queryByText(/custo|margem|criado em|atualizado em/i)).not.toBeInTheDocument();
  });

  it('cliente é barrado na rota do admin: "Sem permissão", sem botões e nenhuma chamada de contratos', async () => {
    // Sem handlers: qualquer chamada à API faria o teste falhar (onUnhandledFrame = error).
    renderApp(ADMIN, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /novo contrato|registrar pagamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('deslogado vai para o login', async () => {
    renderApp(CLIENTE);
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('o admin entrando na rota do cliente também é barrado (rota do cliente é só do cliente)', async () => {
    renderApp(CLIENTE, 'Admin');
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
  });
});

describe('Contratos (cliente) - sidebar', () => {
  beforeEach(() => {
    server.use(listaHandler([]));
  });
  afterEach(() => {
    server.resetHandlers();
  });

  it('"Contratos" fica depois de Financeiro e antes de Relatório fotográfico, aponta para a obra aberta e está ativo', async () => {
    renderApp(CLIENTE, 'Client');

    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const nomes = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent?.trim());
    const i = nomes.indexOf('Contratos');
    expect(i).toBeGreaterThan(-1);
    expect(nomes[i - 1]).toBe('Financeiro');
    expect(nomes[i + 1]).toBe('Relatório fotográfico');
    const link = within(nav).getByRole('link', { name: 'Contratos' });
    expect(link).toHaveAttribute('href', CLIENTE);
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('a sidebar do cliente não tem nenhum link da área do admin', async () => {
    renderApp(CLIENTE, 'Client');

    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    for (const link of within(nav).getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^\/admin/);
    }
    expect(within(nav).queryByRole('link', { name: 'Medições' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Contratos' })).toHaveAttribute(
      'href',
      `/cliente/obras/${OBRA_ID}/contratos`,
    );
  });
});
