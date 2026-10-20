import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { DashboardEtapa, DashboardMedidoMes, DashboardResponse } from '@/interfaces/dashboard';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const OBRA_ID = '22222222-2222-2222-2222-222222222222';
const ROTA = `/cliente/obras/${OBRA_ID}`;
const CAPTION_TABELA = 'Custo acumulado por mês (medições aprovadas)';

const etapa = (over: Partial<DashboardEtapa> = {}): DashboardEtapa => ({
  etapaId: 'e1',
  nome: 'Fundações',
  ordem: 1,
  percentualConcluido: 0,
  status: 'nao_iniciada',
  dataInicioPrevista: '2026-03-01',
  dataFimPrevista: '2026-04-30',
  ...over,
});

const mes = (competencia: string, valorMedido: number, valorMedidoAcumulado: number): DashboardMedidoMes => ({
  competencia,
  valorMedido,
  valorMedidoAcumulado,
});

const dashboard = (over: Partial<DashboardResponse> = {}): DashboardResponse => ({
  obra: {
    id: OBRA_ID,
    nome: 'Residencial Aurora',
    dataInicio: '2025-10-06',
    dataPrevisaoTermino: '2026-12-31',
    status: 'EmAndamento',
  },
  avancoFisicoPercentual: 58.5,
  prazo: { diasRestantes: 72, dataPrevisaoTermino: '2026-12-31' },
  valores: {
    valorContratado: 500000,
    valorMedidoAcumulado: 300000,
    valorRestante: 200000,
    totalPago: 123456.78,
  },
  avancoPorEtapa: [
    etapa({ etapaId: 'e1', nome: 'Terraplenagem', ordem: 1, percentualConcluido: 100, status: 'concluida' }),
    etapa({ etapaId: 'e2', nome: 'Alvenaria', ordem: 2, percentualConcluido: 45.5, status: 'em_andamento' }),
    etapa({ etapaId: 'e3', nome: 'Pintura', ordem: 3, percentualConcluido: 0, status: 'nao_iniciada' }),
  ],
  medidoPorMes: [
    mes('2025-11-01', 28500, 28500),
    mes('2025-12-01', 12000.5, 40500.5),
    mes('2026-02-01', 35000, 75500.5),
  ],
  ...over,
});

const getDashboard = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/dashboard`, () => HttpResponse.json(body as never, { status }));

/** O rótulo do KPI é o <p> pequeno; o card é o pai dele. */
const kpi = async (rotulo: string) => (await screen.findByText(rotulo, { selector: 'p' })).parentElement as HTMLElement;

describe('Dashboard (cliente)', () => {
  describe('estados', () => {
    it('mostra carregando (role=status) e depois o dashboard com o nome da obra', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      expect(screen.getByRole('status')).toHaveTextContent('Carregando dashboard…');
      expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('envia o token do usuário na chamada ao dashboard da obra da rota', async () => {
      let auth: string | null = null;
      server.use(
        http.get(`${API}/obras/${OBRA_ID}/dashboard`, ({ request }) => {
          auth = request.headers.get('authorization');
          return HttpResponse.json(dashboard());
        }),
      );
      renderApp(ROTA, 'Client');

      await screen.findByText('Avanço físico');
      expect(auth).toMatch(/^Bearer .+/);
    });

    it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
      let calls = 0;
      server.use(
        http.get(`${API}/obras/${OBRA_ID}/dashboard`, () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.json({ requestId: 'req-dash-1', message: 'Erro interno' }, { status: 500 })
            : HttpResponse.json(dashboard());
        }),
      );
      renderApp(ROTA, 'Client');

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('req-dash-1');
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();

      await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(await screen.findByText('Avanço físico')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(calls).toBe(2);
    });

    it('erro 403 mostra a mensagem de sem permissão e nenhum dado da obra', async () => {
      server.use(getDashboard({}, 403));
      renderApp(ROTA, 'Client');

      expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para esta ação.');
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('erro 409 mostra o alerta, sem dados', async () => {
      server.use(getDashboard({ message: 'Conflito de estado' }, 409));
      renderApp(ROTA, 'Client');

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();
    });

    it('obra vazia (sem etapas e sem medições) não é erro: cada card mostra o seu vazio', async () => {
      server.use(
        getDashboard(
          dashboard({
            avancoFisicoPercentual: 0,
            prazo: { diasRestantes: null, dataPrevisaoTermino: null },
            valores: { valorContratado: 0, valorMedidoAcumulado: 0, valorRestante: 0, totalPago: 0 },
            avancoPorEtapa: [],
            medidoPorMes: [],
          }),
        ),
      );
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('Nenhuma etapa cadastrada ainda')).toBeInTheDocument();
      expect(screen.getByText('Ainda não há medições aprovadas')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /Gráfico do custo acumulado/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Avanço por etapa' })).not.toBeInTheDocument();
      expect(await kpi('Avanço físico')).toHaveTextContent('0%');
      expect(await kpi('Valor restante')).toHaveTextContent('R$ 0,00');
    });
  });

  describe('KPIs', () => {
    it('avanço físico em %, com vírgula decimal', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      expect(await kpi('Avanço físico')).toHaveTextContent('58,5%');
    });

    it.each([
      {
        nome: '72 dias com a data prevista',
        prazo: { diasRestantes: 72, dataPrevisaoTermino: '2026-12-31' },
        valor: '72 dias',
        hint: 'Previsão: 31/12/2026',
      },
      {
        nome: '1 dia no singular',
        prazo: { diasRestantes: 1, dataPrevisaoTermino: '2026-01-01' },
        valor: '1 dia',
        hint: 'Previsão: 01/01/2026',
      },
      {
        nome: 'zero = Vence hoje',
        prazo: { diasRestantes: 0, dataPrevisaoTermino: '2026-10-20' },
        valor: 'Vence hoje',
        hint: 'Previsão: 20/10/2026',
      },
      {
        nome: 'negativo = vencido há N dias',
        prazo: { diasRestantes: -12, dataPrevisaoTermino: '2026-10-08' },
        valor: 'Prazo vencido há 12 dias',
        hint: 'Previsão era 08/10/2026',
      },
      {
        nome: 'negativo de 1 dia no singular',
        prazo: { diasRestantes: -1, dataPrevisaoTermino: '2026-10-19' },
        valor: 'Prazo vencido há 1 dia',
        hint: 'Previsão era 19/10/2026',
      },
      {
        nome: 'null = sem prazo definido',
        prazo: { diasRestantes: null, dataPrevisaoTermino: null },
        valor: 'Sem prazo definido',
        hint: null,
      },
    ])('prazo: $nome', async ({ prazo, valor, hint }) => {
      server.use(getDashboard(dashboard({ prazo })));
      renderApp(ROTA, 'Client');

      const card = await kpi('Prazo restante');
      expect(card).toHaveTextContent(valor);
      if (hint) expect(within(card).getByText(hint)).toBeInTheDocument();
      else expect(within(card).queryByText(/Previs/)).not.toBeInTheDocument();
      // data de yyyy-MM-dd não pode virar o dia anterior (fuso)
      if (prazo.dataPrevisaoTermino === '2026-12-31') expect(card).not.toHaveTextContent('30/12/2026');
    });

    it('custo acumulado = valor medido acumulado ("medições aprovadas"); total pago só como linha "Pago:"', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const card = await kpi('Custo acumulado');
      const principal = within(card).getByText('R$ 300.000,00');
      expect(principal.tagName).toBe('P');
      expect(within(card).getByText('medições aprovadas')).toBeInTheDocument();
      expect(within(card).getByText('Pago: R$ 123.456,78')).toBeInTheDocument();
      // total pago nunca é o valor principal
      expect(principal).not.toHaveTextContent('123.456,78');
    });

    it('valor restante positivo mostra o valor e "de R$ contratado"', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const card = await kpi('Valor restante');
      expect(card).toHaveTextContent('R$ 200.000,00');
      expect(within(card).getByText('de R$ 500.000,00')).toBeInTheDocument();
      expect(screen.queryByText('Acima do contratado')).not.toBeInTheDocument();
    });

    it('valor restante zero: tudo medido, sem alerta de excesso', async () => {
      server.use(
        getDashboard(
          dashboard({
            valores: { valorContratado: 500000, valorMedidoAcumulado: 500000, valorRestante: 0, totalPago: 0 },
          }),
        ),
      );
      renderApp(ROTA, 'Client');

      const card = await kpi('Valor restante');
      expect(card).toHaveTextContent('R$ 0,00');
      expect(within(card).getByText('de R$ 500.000,00')).toBeInTheDocument();
      expect(screen.queryByText('Acima do contratado')).not.toBeInTheDocument();
    });

    it('valor restante negativo vira "Acima do contratado", sem sinal de menos', async () => {
      server.use(
        getDashboard(
          dashboard({
            valores: { valorContratado: 100000, valorMedidoAcumulado: 101500.5, valorRestante: -1500.5, totalPago: 0 },
          }),
        ),
      );
      renderApp(ROTA, 'Client');

      const card = await kpi('Acima do contratado');
      expect(card).toHaveTextContent('R$ 1.500,50');
      expect(card.textContent).not.toMatch(/[-−–]\s*R\$/);
      expect(within(card).getByText('de R$ 100.000,00')).toBeInTheDocument();
      expect(screen.queryByText('Valor restante')).not.toBeInTheDocument();
    });
  });

  describe('segurança (regra 7: cliente nunca vê custo real nem margem)', () => {
    it('não renderiza nenhum campo extra que o servidor mande por engano nem termos internos', async () => {
      const comExtras = {
        ...dashboard(),
        custoReal: 987654.32,
        margem: 31.7,
        valores: {
          ...dashboard().valores,
          custoReal: 987654.32,
          margemPercentual: 31.7,
        },
        avancoPorEtapa: dashboard().avancoPorEtapa.map((e) => ({
          ...e,
          percentualPeso: 4321,
          peso: 4321,
          createdAt: '2020-01-02T03:04:05Z',
          custoReal: 987654.32,
          storageKey: 'chave-interna-xyz',
        })),
        medidoPorMes: dashboard().medidoPorMes.map((m) => ({ ...m, custoReal: 987654.32 })),
      };
      server.use(getDashboard(comExtras));
      renderApp(ROTA, 'Client');

      await screen.findByText('Avanço físico');
      const texto = document.body.textContent ?? '';
      expect(texto).not.toMatch(/custo real|margem|\bpeso\b|curva s|\bSPI\b|\bCPI\b/i);
      for (const proibido of ['987.654', '987654', '31,7', '4321', '4.321', 'chave-interna-xyz', '2020']) {
        expect(texto).not.toContain(proibido);
      }
    });

    it('é somente leitura: nenhum botão na tela de sucesso', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      await screen.findByText('Avanço físico');
      expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('avanço por etapa', () => {
    it('lista as etapas na ordem do backend, com % na barra e status em Badge', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const lista = await screen.findByRole('list', { name: 'Avanço por etapa' });
      const itens = within(lista).getAllByRole('listitem');
      expect(itens.map((li) => within(li).getByRole('progressbar').getAttribute('aria-label'))).toEqual([
        'Terraplenagem',
        'Alvenaria',
        'Pintura',
      ]);

      expect(within(itens[0]!).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      expect(within(itens[0]!).getByText('100%')).toBeInTheDocument();
      expect(within(itens[0]!).getByText('Concluída')).toBeInTheDocument();
      // barra arredonda para inteiro (ProgressBar)
      expect(within(itens[1]!).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '46');
      expect(within(itens[1]!).getByText('Em andamento')).toBeInTheDocument();
      expect(within(itens[2]!).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      expect(within(itens[2]!).getByText('0%')).toBeInTheDocument();
      expect(within(itens[2]!).getByText('Não iniciada')).toBeInTheDocument();
    });

    it('mantém a ordem recebida mesmo que o campo "ordem" venha fora de sequência', async () => {
      server.use(
        getDashboard(
          dashboard({
            avancoPorEtapa: [
              etapa({ etapaId: 'x1', nome: 'Primeira', ordem: 9 }),
              etapa({ etapaId: 'x2', nome: 'Segunda', ordem: 1 }),
            ],
          }),
        ),
      );
      renderApp(ROTA, 'Client');

      const itens = within(await screen.findByRole('list', { name: 'Avanço por etapa' })).getAllByRole('listitem');
      expect(itens[0]).toHaveTextContent('Primeira');
      expect(itens[1]).toHaveTextContent('Segunda');
    });

    it('o nome da etapa aparece uma vez só (rótulo visível + nome acessível da barra, sem texto repetido)', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      await screen.findByRole('list', { name: 'Avanço por etapa' });
      expect(screen.getAllByText('Terraplenagem')).toHaveLength(1);
      expect(screen.getAllByRole('progressbar', { name: 'Terraplenagem' })).toHaveLength(1);
    });

    it('nome longo é truncado visualmente e o nome completo fica no title', async () => {
      const longo =
        'Revestimento Interno (Reboco) com um nome bem comprido para testar o corte do texto na linha da etapa';
      server.use(getDashboard(dashboard({ avancoPorEtapa: [etapa({ nome: longo, percentualConcluido: 98 })] })));
      renderApp(ROTA, 'Client');

      const rotulo = await screen.findByTitle(longo);
      expect(rotulo).toHaveTextContent(longo);
      expect(rotulo).toHaveClass('truncate');
      // o percentual continua visível ao lado
      expect(screen.getByText('98%')).toBeInTheDocument();
    });

    it('todas as linhas têm a mesma altura (mesma classe de altura fixa)', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const itens = within(await screen.findByRole('list', { name: 'Avanço por etapa' })).getAllByRole('listitem');
      const altura = (el: HTMLElement) => el.className.split(/\s+/).filter((c) => /^h-/.test(c));
      expect(altura(itens[0]!).length).toBeGreaterThan(0);
      for (const li of itens) expect(altura(li)).toEqual(altura(itens[0]!));
    });

    it('status desconhecido aparece cru, sem quebrar a tela', async () => {
      server.use(
        getDashboard(dashboard({ avancoPorEtapa: [etapa({ nome: 'Paisagismo', status: 'suspensa' as never })] })),
      );
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('suspensa')).toBeInTheDocument();
    });

    it('% fora de 0..100 fica limitado na barra', async () => {
      server.use(
        getDashboard(
          dashboard({
            avancoPorEtapa: [
              etapa({ etapaId: 'a', nome: 'Acima', percentualConcluido: 130 }),
              etapa({ etapaId: 'b', nome: 'Abaixo', percentualConcluido: -5 }),
            ],
          }),
        ),
      );
      renderApp(ROTA, 'Client');

      expect(await screen.findByRole('progressbar', { name: 'Acima' })).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByRole('progressbar', { name: 'Abaixo' })).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('gráfico de custo acumulado', () => {
    it('tem role="img" com resumo acessível do período e do acumulado final', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const grafico = await screen.findByRole('img', { name: /Gráfico do custo acumulado/ });
      expect(grafico).toHaveAccessibleName(/Nov\/25 a Fev\/26/);
      expect(grafico.getAttribute('aria-label')?.replace(/\s/g, ' ')).toContain('R$ 75.500,50');
      // O desenho (svg) depende de medida de layout: jsdom não mede (largura 0). Coberto no e2e (Chromium real).
    });

    it('legenda mostra barra (medido no mês) e linha (acumulado)', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const legenda = await screen.findByRole('list', { name: 'Legenda do gráfico' });
      expect(within(legenda).getByText('Medido no mês')).toBeInTheDocument();
      expect(within(legenda).getByText('Acumulado')).toBeInTheDocument();
    });

    it('tabela alternativa: uma linha por mês, completando meses vazios com R$ 0,00 e acumulado mantido', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const tabela = await screen.findByRole('table', { name: CAPTION_TABELA });
      expect(within(tabela).getByRole('columnheader', { name: 'Mês' })).toBeInTheDocument();
      expect(within(tabela).getByRole('columnheader', { name: 'Medido no mês' })).toBeInTheDocument();
      expect(within(tabela).getByRole('columnheader', { name: 'Acumulado' })).toBeInTheDocument();

      const linhas = within(tabela).getAllByRole('row').slice(1);
      const celulas = linhas.map((l) =>
        within(l)
          .getAllByRole('cell')
          .map((c) => c.textContent?.replace(/\s/g, ' ')),
      );
      expect(celulas).toEqual([
        ['Novembro de 2025', 'R$ 28.500,00', 'R$ 28.500,00'],
        ['Dezembro de 2025', 'R$ 12.000,50', 'R$ 40.500,50'],
        ['Janeiro de 2026', 'R$ 0,00', 'R$ 40.500,50'],
        ['Fevereiro de 2026', 'R$ 35.000,00', 'R$ 75.500,50'],
      ]);
    });

    it('um mês só = uma linha na tabela e resumo sem período repetido', async () => {
      server.use(getDashboard(dashboard({ medidoPorMes: [mes('2026-10-01', 20000, 20000)] })));
      renderApp(ROTA, 'Client');

      const tabela = await screen.findByRole('table', { name: CAPTION_TABELA });
      expect(within(tabela).getAllByRole('row').slice(1)).toHaveLength(1);
      expect(within(tabela).getByText('Outubro de 2026')).toBeInTheDocument();
      const grafico = screen.getByRole('img', { name: /Gráfico do custo acumulado/ });
      expect(grafico.getAttribute('aria-label')).toContain('de Out/26.');
    });

    it('meses atravessando a virada de ano ficam em ordem cronológica', async () => {
      server.use(getDashboard(dashboard({ medidoPorMes: [mes('2026-12-01', 10, 10), mes('2027-02-01', 5, 15)] })));
      renderApp(ROTA, 'Client');

      const tabela = await screen.findByRole('table', { name: CAPTION_TABELA });
      const meses = within(tabela)
        .getAllByRole('row')
        .slice(1)
        .map((l) => within(l).getAllByRole('cell')[0]!.textContent);
      expect(meses).toEqual(['Dezembro de 2026', 'Janeiro de 2027', 'Fevereiro de 2027']);
    });

    it('intervalo maior que 120 meses não é completado (só os meses que vieram da API)', async () => {
      server.use(
        getDashboard(dashboard({ medidoPorMes: [mes('2010-01-01', 1000, 1000), mes('2026-01-01', 500, 1500)] })),
      );
      renderApp(ROTA, 'Client');

      const tabela = await screen.findByRole('table', { name: CAPTION_TABELA });
      expect(within(tabela).getAllByRole('row').slice(1)).toHaveLength(2);
    });

    it('sem medições mostra o vazio e nenhum gráfico nem tabela', async () => {
      server.use(getDashboard(dashboard({ medidoPorMes: [] })));
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('Ainda não há medições aprovadas')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /Gráfico do custo acumulado/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Legenda do gráfico' })).not.toBeInTheDocument();
    });

    it('títulos dos cards seguem o SPEC §5', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      expect(await screen.findByText('Custo acumulado — todos os meses')).toBeInTheDocument();
      // o título "Avanço por etapa" do card também é o nome da lista
      expect(screen.getAllByText('Avanço por etapa').length).toBeGreaterThan(0);
    });
  });

  describe('papéis e guarda de rota', () => {
    it('cliente sem acesso à obra (403 do backend) vê o erro tratado, sem dados', async () => {
      server.use(http.get(`${API}/obras/outra-obra/dashboard`, () => new HttpResponse(null, { status: 403 })));
      renderApp('/cliente/obras/outra-obra', 'Client');

      expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();
    });

    it.each(['Admin', 'Master'] as const)('%s em /admin/obras/:obraId continua com o placeholder', async (role) => {
      renderApp(`/admin/obras/${OBRA_ID}`, role);

      expect(await screen.findByRole('heading', { name: 'Dashboard (em construção)' })).toBeInTheDocument();
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();
    });

    it.each(['Admin', 'Master'] as const)('%s não entra na rota do dashboard do cliente', async (role) => {
      renderApp(ROTA, role);

      expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();
    });

    it('cliente barrado na rota admin, sem montar o placeholder do admin', async () => {
      renderApp(`/admin/obras/${OBRA_ID}`, 'Client');

      expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
      expect(screen.queryByText(/em construção/)).not.toBeInTheDocument();
    });

    it('deslogado é enviado ao login', async () => {
      renderApp(ROTA);

      expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
      expect(screen.queryByText('Avanço físico')).not.toBeInTheDocument();
    });
  });

  describe('sidebar', () => {
    it('"Dashboard" é o item ativo na rota do dashboard e os demais não', async () => {
      server.use(getDashboard(dashboard()));
      renderApp(ROTA, 'Client');

      const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
      expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByRole('link', { name: 'Cronograma' })).not.toHaveAttribute('aria-current');
    });

    it('"Dashboard" deixa de ficar ativo numa sub-rota (end: true)', async () => {
      server.use(http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json([])));
      renderApp(`${ROTA}/cronograma`, 'Client');

      const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
      expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
      expect(within(nav).getByRole('link', { name: 'Cronograma' })).toHaveAttribute('aria-current', 'page');
    });
  });
});
