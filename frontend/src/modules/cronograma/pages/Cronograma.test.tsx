import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';

const OBRA_ID = '22222222-2222-2222-2222-222222222222';
const ROTA = `/cliente/obras/${OBRA_ID}/cronograma`;

const etapa = (over: Partial<EtapaCronograma> = {}): EtapaCronograma => ({
  id: 'e1',
  obraId: OBRA_ID,
  nome: 'Fundação',
  ordem: 1,
  percentualPeso: 10,
  dataInicioPrevista: '2026-03-01',
  dataFimPrevista: '2026-04-30',
  dataInicioReal: null,
  dataFimReal: null,
  status: 'nao_iniciada',
  createdAt: '2026-01-10T12:00:00Z',
  ...over,
});

const getEtapas = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json(body as never, { status }));

const cenario = (): EtapaCronograma[] => [
  etapa({
    id: 'e1',
    nome: 'Fundação',
    ordem: 1,
    status: 'concluida',
    dataInicioReal: '2026-03-02',
    dataFimReal: '2026-04-28',
  }),
  etapa({
    id: 'e2',
    nome: 'Alvenaria',
    ordem: 2,
    status: 'em_andamento',
    dataInicioPrevista: '2026-05-01',
    dataFimPrevista: '2026-12-31',
    dataInicioReal: '2026-05-05',
  }),
  etapa({
    id: 'e3',
    nome: 'Telhado',
    ordem: 3,
    status: 'nao_iniciada',
    dataInicioPrevista: '2027-01-01',
    dataFimPrevista: '2027-02-15',
  }),
  etapa({
    id: 'e4',
    nome: 'Pintura',
    ordem: 4,
    status: 'nao_iniciada',
    dataInicioPrevista: null,
    dataFimPrevista: null,
  }),
  etapa({
    id: 'e5',
    nome: 'Paisagismo',
    ordem: 5,
    status: 'suspensa',
    dataInicioPrevista: '2026-10-01',
    dataFimPrevista: null,
  }),
];

describe('Cronograma (cliente)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra carregando e depois KPIs e linha do tempo', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Client');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando cronograma…');
    expect(await screen.findByRole('heading', { name: 'Cronograma' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Linha do tempo das etapas' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('KPIs contam por status; status desconhecido entra só no total e aparece cru', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Client');

    // O rótulo do KPI é o <p>; "Em andamento"/"Concluída" também aparecem em badges e na legenda.
    const kpi = async (rotulo: string) =>
      (await screen.findByText(rotulo, { selector: 'p' })).parentElement as HTMLElement;
    expect(await kpi('Etapas totais')).toHaveTextContent('5');
    expect(await kpi('Concluídas')).toHaveTextContent('1');
    expect(await kpi('Em andamento')).toHaveTextContent('1');
    expect(await kpi('Não iniciadas')).toHaveTextContent('2');
    expect(screen.getByText('suspensa')).toBeInTheDocument();
  });

  it('barras previstas e reais têm descrição acessível com datas sem deslocar o fuso', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Client');

    expect(
      await screen.findByRole('img', { name: 'Fundação: previsto de 01/03/2026 a 30/04/2026, Concluída' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundação: realizado de 02/03/2026 a 28/04/2026' })).toBeInTheDocument();
    // dia 31 e virada de ano
    expect(
      screen.getByRole('img', { name: 'Alvenaria: previsto de 01/05/2026 a 31/12/2026, Em andamento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Telhado: previsto de 01/01/2027 a 15/02/2027, Não iniciada' }),
    ).toBeInTheDocument();
    // só início real: sem barra real, com texto
    expect(screen.queryByRole('img', { name: /Alvenaria: realizado/ })).not.toBeInTheDocument();
    expect(screen.getByText('Real: iniciada em 05/05/2026')).toBeInTheDocument();
  });

  it('texto de período real parcial: só fim real = concluída em', async () => {
    server.use(getEtapas([etapa({ dataFimReal: '2026-04-10', status: 'concluida' })]));
    renderApp(ROTA, 'Client');

    expect(await screen.findByText('Real: concluída em 10/04/2026')).toBeInTheDocument();
  });

  it('etapa sem datas ou com só uma data prevista mostra "Sem datas previstas" e nenhuma barra', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Client');

    expect(await screen.findAllByText('Sem datas previstas')).toHaveLength(2);
    expect(screen.queryByRole('img', { name: /Pintura/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Paisagismo/ })).not.toBeInTheDocument();
  });

  it('cabeçalhos de mês cobrem do primeiro ao último mês e atravessam a virada do ano', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Client');

    const regiao = await screen.findByRole('region', { name: 'Linha do tempo das etapas' });
    for (const mes of ['Mar/26', 'Dez/26', 'Jan/27', 'Fev/27']) {
      expect(within(regiao).getByText(mes)).toBeInTheDocument();
    }
    expect(within(regiao).queryByText('Fev/26')).not.toBeInTheDocument();
    expect(within(regiao).queryByText('Mar/27')).not.toBeInTheDocument();
  });

  it('mostra "Hoje: dd/mm/aaaa" e a legenda de hoje quando o mês de hoje está na grade', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Client');

    expect(await screen.findByText(/Hoje: 15\/10\/2026/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Legenda' })).getByText('Hoje')).toBeInTheDocument();
  });

  it('não mostra "Hoje" quando o mês de hoje está fora da grade', async () => {
    server.use(getEtapas([etapa()]));
    renderApp(ROTA, 'Client');

    await screen.findByRole('img', { name: /Fundação: previsto/ });
    expect(screen.queryByText(/Hoje:/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Legenda' })).queryByText('Hoje')).not.toBeInTheDocument();
  });

  it('sem nenhuma data a grade tem só o mês de hoje', async () => {
    server.use(getEtapas([etapa({ dataInicioPrevista: null, dataFimPrevista: null })]));
    renderApp(ROTA, 'Client');

    const regiao = await screen.findByRole('region', { name: 'Linha do tempo das etapas' });
    expect(within(regiao).getByText('Out/26')).toBeInTheDocument();
    expect(screen.getByText(/Hoje: 15\/10\/2026/)).toBeInTheDocument();
  });

  it('estado vazio mostra a mensagem do SPEC', async () => {
    server.use(getEtapas([]));
    renderApp(ROTA, 'Client');

    expect(await screen.findByText('O cronograma desta obra ainda não foi cadastrado')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Linha do tempo das etapas' })).not.toBeInTheDocument();
  });

  it('erro 500 mostra o código de suporte e permite tentar de novo', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/etapas`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-crono-1', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json(cenario());
      }),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-crono-1');
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Etapas totais')).toBeInTheDocument();
  });

  it('erro 403 (obra não vinculada) mostra sem permissão e nenhuma etapa', async () => {
    server.use(getEtapas({}, 403));
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('erro 409 mostra a mensagem de conflito, sem etapas', async () => {
    server.use(getEtapas({ message: 'Conflito de estado' }, 409));
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Etapas totais')).not.toBeInTheDocument();
  });

  describe('papéis', () => {
    it('cliente não vê botão de escrita, porcentagem, Curva S nem termos internos', async () => {
      server.use(getEtapas(cenario()));
      renderApp(ROTA, 'Client');

      await screen.findByText('Etapas totais');
      const main = screen.getByRole('main');
      expect(within(main).queryByRole('button')).not.toBeInTheDocument();
      expect(within(main).queryByText(/curva s|\bSPI\b|\bCPI\b|custo real|margem/i)).not.toBeInTheDocument();
      expect(within(main).queryByText(/%/)).not.toBeInTheDocument();
    });

    it.each(['Admin', 'Master'] as const)('%s não entra na rota do cliente', async (role) => {
      renderApp(ROTA, role);
      expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    });

    it('deslogado é enviado ao login', async () => {
      renderApp(ROTA);
      expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
    });
  });

  it('sidebar: "Cronograma" entre Dashboard e Fechamento e ativo na rota', async () => {
    server.use(getEtapas([]));
    renderApp(ROTA, 'Client');

    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const nomes = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    const i = nomes.indexOf('Cronograma');
    expect(i).toBeGreaterThan(-1);
    expect(nomes[i - 1]).toBe('Dashboard');
    expect(nomes[i + 1]).toBe('Fechamento');
    expect(within(nav).getByRole('link', { name: 'Cronograma' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
});
