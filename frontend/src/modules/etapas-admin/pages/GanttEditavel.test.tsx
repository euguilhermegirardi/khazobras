import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';
import { useSalvarEtapa } from '../hooks';

const OBRA_ID = '22222222-2222-2222-2222-222222222222';
const ROTA = `/admin/obras/${OBRA_ID}/gantt`;

const etapa = (over: Partial<EtapaCronograma> = {}): EtapaCronograma => ({
  id: 'e1',
  obraId: OBRA_ID,
  nome: 'Fundação',
  ordem: 1,
  percentualPeso: 20,
  dataInicioPrevista: '2026-03-01',
  dataFimPrevista: '2026-04-30',
  dataInicioReal: null,
  dataFimReal: null,
  status: 'nao_iniciada',
  percentualConcluido: 0,
  createdAt: '2026-01-10T12:00:00Z',
  ...over,
});

// Ordens com buraco (1, 2, 5): a próxima ordem é maior + 1 = 6, não quantidade + 1 = 4.
const cenario = (): EtapaCronograma[] => [
  etapa({
    id: 'e1',
    nome: 'Fundação',
    ordem: 1,
    status: 'concluida',
    percentualConcluido: 100,
    dataInicioReal: '2026-03-02',
    dataFimReal: '2026-04-28',
  }),
  etapa({
    id: 'e2',
    nome: 'Alvenaria',
    ordem: 2,
    percentualPeso: 30,
    status: 'em_andamento',
    percentualConcluido: 40,
    dataInicioPrevista: '2026-05-01',
    dataFimPrevista: '2026-12-31',
    dataInicioReal: '2026-05-05',
  }),
  etapa({
    id: 'e5',
    nome: 'Telhado',
    ordem: 5,
    percentualPeso: 12.5,
    dataInicioPrevista: '2027-01-01',
    dataFimPrevista: '2027-02-15',
  }),
];

const getEtapas = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json(body as never, { status }));

/** GET que devolve a lista mutável (para simular o servidor após o PUT/POST) e conta as chamadas. */
function listaViva(inicial: EtapaCronograma[]) {
  const estado = { lista: inicial, gets: 0 };
  const handler = http.get(`${API}/obras/${OBRA_ID}/etapas`, () => {
    estado.gets += 1;
    return HttpResponse.json(estado.lista);
  });
  return { estado, handler };
}

const user = () => userEvent.setup();

const abrirEdicao = async (u: ReturnType<typeof user>, nome: string) => {
  await u.click(await screen.findByRole('button', { name: `Editar etapa ${nome}` }));
  return screen.findByRole('dialog', { name: 'Editar etapa' });
};

const setTexto = async (u: ReturnType<typeof user>, campo: HTMLElement, valor: string) => {
  await u.clear(campo);
  if (valor !== '') await u.type(campo, valor);
};

/** Input de data: o jsdom aceita o valor direto, sem simular o seletor nativo. */
const setData = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });

describe('Gantt editável: estados da tela', () => {
  it('mostra carregando e depois a tabela com as etapas na ordem', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando etapas');
    expect(await screen.findByRole('heading', { name: 'Gantt editável' })).toBeInTheDocument();
    const tabela = await screen.findByRole('table');
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(4); // cabeçalho + 3
    expect(linhas[1]).toHaveTextContent('Fundação');
    expect(linhas[2]).toHaveTextContent('Alvenaria');
    expect(linhas[3]).toHaveTextContent('Telhado');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cada linha mostra período previsto e real, % de execução, status e peso', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Admin');

    const fundacao = (await screen.findByText('Fundação')).closest('tr') as HTMLElement;
    expect(within(fundacao).getByText('01/03/2026 a 30/04/2026')).toBeInTheDocument();
    expect(within(fundacao).getByText('02/03/2026 a 28/04/2026')).toBeInTheDocument();
    expect(within(fundacao).getByText('Concluída')).toBeInTheDocument();
    expect(within(fundacao).getByRole('progressbar', { name: '% concluído de Fundação' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(within(fundacao).getByText('20%')).toBeInTheDocument();

    const alvenaria = screen.getByText('Alvenaria').closest('tr') as HTMLElement;
    expect(within(alvenaria).getByText('Em andamento')).toBeInTheDocument();
    expect(within(alvenaria).getByText('Desde 05/05/2026')).toBeInTheDocument();
    expect(within(alvenaria).getByRole('progressbar', { name: '% concluído de Alvenaria' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );

    const telhado = screen.getByText('Telhado').closest('tr') as HTMLElement;
    expect(within(telhado).getByText('Não iniciada')).toBeInTheDocument();
    expect(within(telhado).getByText('12,5%')).toBeInTheDocument();
    expect(within(telhado).getByText('—')).toBeInTheDocument(); // sem datas reais
  });

  it('obra sem etapas mostra o vazio com "+ Etapa" (um só botão)', async () => {
    server.use(getEtapas([]));
    renderApp(ROTA, 'Admin');

    expect(await screen.findByText('Nenhuma etapa cadastrada')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Etapa' })).toHaveLength(1);
  });

  it('erro 500 mostra o código de suporte e "Tentar novamente" refaz a busca', async () => {
    let chamadas = 0;
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/etapas`, () => {
        chamadas += 1;
        return chamadas === 1
          ? HttpResponse.json({ requestId: 'req-gantt-500', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json(cenario());
      }),
    );
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('req-gantt-500');
    await user().click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Fundação')).toBeInTheDocument();
  });

  it('403 ao carregar mostra a mensagem de permissão, sem tabela', async () => {
    server.use(getEtapas({}, 403));
    renderApp(ROTA, 'Admin');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('não oferece botão de excluir etapa', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Admin');

    await screen.findByText('Fundação');
    expect(screen.queryByRole('button', { name: /exclu|remov|apagar|delet/i })).not.toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Editar etapa Fundação' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar etapa' });
    expect(within(dialog).queryByRole('button', { name: /exclu|remov|apagar|delet/i })).not.toBeInTheDocument();
  });
});

describe('Gantt editável: papéis', () => {
  it.each(['Admin', 'Master'] as const)('%s entra no Gantt e vê "+ Etapa" e "Editar"', async (role) => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, role);

    expect(await screen.findByRole('heading', { name: 'Gantt editável' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '+ Etapa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar etapa Fundação' })).toBeInTheDocument();
  });

  it('cliente é barrado: "Sem permissão", sem tabela, botões nem chamada à API de etapas', async () => {
    let chamadas = 0;
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/etapas`, () => {
        chamadas += 1;
        return HttpResponse.json(cenario());
      }),
    );
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gantt editável' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Etapa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(chamadas).toBe(0);
  });

  it('deslogado vai para o login', async () => {
    renderApp(ROTA);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gantt editável' })).not.toBeInTheDocument();
  });

  it('cliente não vê a rota do admin pelo menu: o cronograma dele não tem botões de escrita', async () => {
    server.use(getEtapas(cenario()));
    renderApp(`/cliente/obras/${OBRA_ID}/cronograma`, 'Client');

    await screen.findByRole('region', { name: 'Linha do tempo das etapas' });
    expect(screen.queryByRole('link', { name: 'Gantt editável' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Gantt editável: navegação', () => {
  const obra = {
    id: OBRA_ID,
    nome: 'Residencial Aurora',
    endereco: 'Rua das Flores, 100',
    valorContratado: 1500000,
    dataInicio: '2026-03-01',
    dataPrevisaoTermino: '2026-12-15',
    status: 'EmAndamento',
    createdAt: '2026-02-20T12:00:00Z',
  };

  it('hub → obra → Gantt pela sidebar → "← Meus projetos" volta ao hub', async () => {
    server.use(
      http.get(`${API}/obras`, () => HttpResponse.json({ totalItems: 1, pageIndex: 0, pageSize: 50, items: [obra] })),
      getEtapas(cenario()),
    );
    const u = user();
    renderApp('/admin', 'Admin');

    await u.click(await screen.findByRole('link', { name: /Residencial Aurora/ }));
    expect(await screen.findByRole('heading', { name: /Dashboard/ })).toBeInTheDocument();

    await u.click(screen.getByRole('link', { name: 'Gantt editável' }));
    expect(await screen.findByRole('heading', { name: 'Gantt editável' })).toBeInTheDocument();
    expect(await screen.findByText('Fundação')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gantt editável' })).toHaveAttribute('aria-current', 'page');

    await u.click(within(screen.getByRole('main')).getByRole('link', { name: 'Meus projetos' }));
    expect(await screen.findByRole('heading', { name: 'Meus projetos' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Residencial Aurora/ })).toBeInTheDocument();
  });

  it('a tela da obra tem o link "← Meus projetos" apontando para /admin', async () => {
    server.use(getEtapas(cenario()));
    renderApp(ROTA, 'Admin');

    await screen.findByText('Fundação');
    const voltar = within(screen.getByRole('main')).getByRole('link', { name: 'Meus projetos' });
    expect(voltar).toHaveAttribute('href', '/admin');
  });
});

describe('Gantt editável: diálogo de edição', () => {
  it('abre preenchido com os dados da etapa', async () => {
    server.use(getEtapas(cenario()));
    const u = user();
    renderApp(ROTA, 'Admin');

    const dialog = await abrirEdicao(u, 'Alvenaria');
    expect(within(dialog).getByLabelText('Nome da etapa')).toHaveValue('Alvenaria');
    expect(within(dialog).getByLabelText('Ordem')).toHaveValue(2);
    expect(within(dialog).getByLabelText('Peso (%)')).toHaveValue(30);
    expect(within(dialog).getByLabelText('Início previsto')).toHaveValue('2026-05-01');
    expect(within(dialog).getByLabelText('Fim previsto')).toHaveValue('2026-12-31');
    expect(within(dialog).getByLabelText('Início real')).toHaveValue('2026-05-05');
    expect(within(dialog).getByLabelText('Fim real')).toHaveValue('');
    expect(within(dialog).getByLabelText('Status')).toHaveValue('em_andamento');
    expect(within(dialog).getByLabelText('% concluído')).toHaveValue(40);
  });

  it('Cancelar fecha sem enviar; reabrir mostra de novo os valores da etapa (descarta o que foi digitado)', async () => {
    let puts = 0;
    server.use(
      getEtapas(cenario()),
      http.put(`${API}/etapas/:id`, () => {
        puts += 1;
        return HttpResponse.json(etapa());
      }),
    );
    const u = user();
    renderApp(ROTA, 'Admin');

    let dialog = await abrirEdicao(u, 'Alvenaria');
    await setTexto(u, within(dialog).getByLabelText('Nome da etapa'), 'Outro nome');
    await u.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    dialog = await abrirEdicao(u, 'Alvenaria');
    expect(within(dialog).getByLabelText('Nome da etapa')).toHaveValue('Alvenaria');
    expect(puts).toBe(0);
  });

  describe('sugestão de status pelo %', () => {
    it('0 → não iniciada, 100 → concluída, outro valor → em andamento', async () => {
      server.use(getEtapas(cenario()));
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      const percentual = within(dialog).getByLabelText('% concluído');
      const status = within(dialog).getByLabelText('Status');

      await setTexto(u, percentual, '100');
      expect(status).toHaveValue('concluida');
      await setTexto(u, percentual, '0');
      expect(status).toHaveValue('nao_iniciada');
      await setTexto(u, percentual, '60');
      expect(status).toHaveValue('em_andamento');
    });

    it('% inválido (fora de 0..100) não muda o status', async () => {
      server.use(getEtapas(cenario()));
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      await setTexto(u, within(dialog).getByLabelText('% concluído'), '150');
      expect(within(dialog).getByLabelText('Status')).toHaveValue('em_andamento');
    });

    it('não trava o select: o admin escolhe outro status e ele permanece', async () => {
      server.use(getEtapas(cenario()));
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      const status = within(dialog).getByLabelText('Status');
      await setTexto(u, within(dialog).getByLabelText('% concluído'), '100');
      expect(status).toHaveValue('concluida');

      await u.selectOptions(status, 'em_andamento');
      expect(status).toHaveValue('em_andamento');
      expect(within(dialog).getByLabelText('% concluído')).toHaveValue(100); // o % não é alterado pelo status
    });
  });

  describe('validação no formulário (sem enviar ao servidor)', () => {
    const preparar = async () => {
      let puts = 0;
      server.use(
        getEtapas(cenario()),
        http.put(`${API}/etapas/:id`, () => {
          puts += 1;
          return HttpResponse.json(etapa());
        }),
      );
      const u = user();
      renderApp(ROTA, 'Admin');
      const dialog = await abrirEdicao(u, 'Alvenaria');
      const salvar = async () => u.click(within(dialog).getByRole('button', { name: 'Salvar' }));
      return { u, dialog, salvar, puts: () => puts };
    };

    it('nome obrigatório', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      await setTexto(u, within(dialog).getByLabelText('Nome da etapa'), '');
      await salvar();

      const campo = within(dialog).getByLabelText('Nome da etapa');
      await waitFor(() => expect(campo).toHaveAccessibleDescription(/nome/i));
      expect(campo).toBeInvalid();
      expect(puts()).toBe(0);
      expect(screen.getByRole('dialog', { name: 'Editar etapa' })).toBeInTheDocument();
    });

    it('nome com mais de 150 caracteres', async () => {
      const { dialog, salvar, puts } = await preparar();
      const campo = within(dialog).getByLabelText('Nome da etapa');
      fireEvent.change(campo, { target: { value: 'a'.repeat(151) } });
      await salvar();

      await waitFor(() => expect(campo).toHaveAccessibleDescription(/150/));
      expect(puts()).toBe(0);
    });

    it('ordem menor que 1', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      await setTexto(u, within(dialog).getByLabelText('Ordem'), '0');
      await salvar();

      await waitFor(() => expect(within(dialog).getByLabelText('Ordem')).toHaveAccessibleDescription(/ordem/i));
      expect(puts()).toBe(0);
    });

    it.each(['101', '-5'])('peso fora de 0..100 (%s)', async (valor) => {
      const { u, dialog, salvar, puts } = await preparar();
      await setTexto(u, within(dialog).getByLabelText('Peso (%)'), valor);
      await salvar();

      await waitFor(() => expect(within(dialog).getByLabelText('Peso (%)')).toHaveAccessibleDescription(/0 e 100/));
      expect(puts()).toBe(0);
    });

    it('% concluído acima de 100', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      await setTexto(u, within(dialog).getByLabelText('% concluído'), '101');
      await salvar();

      await waitFor(() => expect(within(dialog).getByLabelText('% concluído')).toHaveAccessibleDescription(/0 e 100/));
      expect(puts()).toBe(0);
    });

    it('fim previsto antes do início previsto', async () => {
      const { dialog, salvar, puts } = await preparar();
      setData(within(dialog).getByLabelText('Fim previsto'), '2026-04-30');
      await salvar();

      await waitFor(() =>
        expect(within(dialog).getByLabelText('Fim previsto')).toHaveAccessibleDescription(/anterior/i),
      );
      expect(puts()).toBe(0);
    });

    it('fim real antes do início real', async () => {
      const { dialog, salvar, puts } = await preparar();
      setData(within(dialog).getByLabelText('Fim real'), '2026-05-01');
      await salvar();

      await waitFor(() => expect(within(dialog).getByLabelText('Fim real')).toHaveAccessibleDescription(/anterior/i));
      expect(puts()).toBe(0);
    });

    it('não iniciada exige 0% e não aceita datas reais', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      await u.selectOptions(within(dialog).getByLabelText('Status'), 'nao_iniciada');
      await salvar();

      await waitFor(() =>
        expect(within(dialog).getByLabelText('% concluído')).toHaveAccessibleDescription(/não iniciada.*0%/i),
      );
      expect(within(dialog).getByLabelText('Início real')).toHaveAccessibleDescription(/não iniciada/i);
      expect(puts()).toBe(0);
    });

    it('em andamento exige início real e não aceita 100% nem fim real', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      setData(within(dialog).getByLabelText('Início real'), '');
      setData(within(dialog).getByLabelText('Fim real'), '2026-06-01');
      await setTexto(u, within(dialog).getByLabelText('% concluído'), '100');
      await u.selectOptions(within(dialog).getByLabelText('Status'), 'em_andamento'); // volta, pois o % sugeriu "concluída"
      await salvar();

      await waitFor(() =>
        expect(within(dialog).getByLabelText('Início real')).toHaveAccessibleDescription(/em andamento/i),
      );
      expect(within(dialog).getByLabelText('Fim real')).toHaveAccessibleDescription(/em andamento/i);
      expect(within(dialog).getByLabelText('% concluído')).toHaveAccessibleDescription(/100%/);
      expect(puts()).toBe(0);
    });

    it('concluída exige 100% e as duas datas reais', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      await u.selectOptions(within(dialog).getByLabelText('Status'), 'concluida'); // % continua 40
      await salvar();

      await waitFor(() =>
        expect(within(dialog).getByLabelText('% concluído')).toHaveAccessibleDescription(/concluída.*100%/i),
      );
      expect(within(dialog).getByLabelText('Fim real')).toHaveAccessibleDescription(/concluída/i);
      expect(puts()).toBe(0);
    });

    it('corrigir o erro e salvar de novo envia', async () => {
      const { u, dialog, salvar, puts } = await preparar();
      await setTexto(u, within(dialog).getByLabelText('Nome da etapa'), '');
      await salvar();
      await waitFor(() => expect(within(dialog).getByLabelText('Nome da etapa')).toBeInvalid());

      await u.type(within(dialog).getByLabelText('Nome da etapa'), 'Alvenaria nova');
      await salvar();
      await waitFor(() => expect(puts()).toBe(1));
    });
  });

  describe('envio (PUT /etapas/{id})', () => {
    it('envia o corpo exato com todos os campos e, no sucesso, fecha, avisa e refaz o GET', async () => {
      const { estado, handler } = listaViva(cenario());
      let corpo: unknown;
      let idChamado = '';
      let auth = '';
      server.use(
        handler,
        http.put(`${API}/etapas/:id`, async ({ request, params }) => {
          corpo = await request.json();
          idChamado = String(params.id);
          auth = request.headers.get('Authorization') ?? '';
          const atualizada = etapa({
            id: 'e2',
            nome: 'Alvenaria estrutural',
            ordem: 2,
            percentualPeso: 30,
            status: 'em_andamento',
            percentualConcluido: 60,
            dataInicioPrevista: '2026-05-01',
            dataFimPrevista: '2026-12-31',
            dataInicioReal: '2026-05-05',
          });
          estado.lista = estado.lista.map((e) => (e.id === 'e2' ? atualizada : e));
          return HttpResponse.json(atualizada);
        }),
      );
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      expect(estado.gets).toBe(1);
      await setTexto(u, within(dialog).getByLabelText('Nome da etapa'), 'Alvenaria estrutural');
      await setTexto(u, within(dialog).getByLabelText('% concluído'), '60');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(idChamado).toBe('e2');
      expect(auth).toMatch(/^Bearer /);
      expect(corpo).toEqual({
        nome: 'Alvenaria estrutural',
        ordem: 2,
        percentualPeso: 30,
        dataInicioPrevista: '2026-05-01',
        dataFimPrevista: '2026-12-31',
        dataInicioReal: '2026-05-05',
        dataFimReal: null,
        status: 'em_andamento',
        percentualConcluido: 60,
      });
      expect(await screen.findByRole('status')).toHaveTextContent('Etapa "Alvenaria estrutural" atualizada.');
      // refaz o GET e a tabela mostra o dado novo
      await waitFor(() => expect(estado.gets).toBe(2));
      const linha = (await screen.findByText('Alvenaria estrutural')).closest('tr') as HTMLElement;
      expect(within(linha).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
    });

    it('concluir a etapa: % 100 sugere "concluída" e o corpo leva as duas datas reais', async () => {
      let corpo: unknown;
      server.use(
        getEtapas(cenario()),
        http.put(`${API}/etapas/:id`, async ({ request }) => {
          corpo = await request.json();
          return HttpResponse.json(etapa({ id: 'e2' }));
        }),
      );
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      await setTexto(u, within(dialog).getByLabelText('% concluído'), '100');
      expect(within(dialog).getByLabelText('Status')).toHaveValue('concluida');
      setData(within(dialog).getByLabelText('Fim real'), '2026-11-20');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(corpo).toBeDefined());
      expect(corpo).toMatchObject({
        status: 'concluida',
        percentualConcluido: 100,
        dataInicioReal: '2026-05-05',
        dataFimReal: '2026-11-20',
      });
    });

    it('limpar uma data opcional envia null (não string vazia)', async () => {
      let corpo: Record<string, unknown> = {};
      server.use(
        getEtapas(cenario()),
        http.put(`${API}/etapas/:id`, async ({ request }) => {
          corpo = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(etapa({ id: 'e5' }));
        }),
      );
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Telhado');
      setData(within(dialog).getByLabelText('Fim previsto'), '');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(corpo.nome).toBe('Telhado'));
      expect(corpo.dataFimPrevista).toBeNull();
      expect(corpo.dataInicioReal).toBeNull();
      expect(corpo.dataFimReal).toBeNull();
    });

    it('enquanto salva, os botões ficam desabilitados e mostram "Salvando…"', async () => {
      let liberar: () => void = () => {};
      const espera = new Promise<void>((resolve) => {
        liberar = resolve;
      });
      server.use(
        getEtapas(cenario()),
        http.put(`${API}/etapas/:id`, async () => {
          await espera;
          return HttpResponse.json(etapa({ id: 'e2' }));
        }),
      );
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      const salvando = await within(dialog).findByRole('button', { name: 'Salvando…' });
      expect(salvando).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      liberar();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  describe('erros do servidor no PUT', () => {
    const abrirESalvar = async (resposta: () => Response) => {
      server.use(
        getEtapas(cenario()),
        http.put(`${API}/etapas/:id`, () => resposta()),
      );
      const u = user();
      renderApp(ROTA, 'Admin');
      const dialog = await abrirEdicao(u, 'Alvenaria');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));
      return dialog;
    };

    it('400 (PascalCase) vira mensagem no campo certo, o diálogo continua aberto e sem Alert geral', async () => {
      const dialog = await abrirESalvar(() =>
        HttpResponse.json(
          {
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: {
              Nome: ['Já existe uma etapa com este nome.'],
              PercentualPeso: ['A soma dos pesos passa de 100%.'],
              DataFimReal: ['O fim real deve ser após o início real.'],
              Status: ['Transição inválida.'],
            },
          },
          { status: 400 },
        ),
      );

      await waitFor(() =>
        expect(within(dialog).getByLabelText('Nome da etapa')).toHaveAccessibleDescription(
          'Já existe uma etapa com este nome.',
        ),
      );
      expect(within(dialog).getByLabelText('Peso (%)')).toHaveAccessibleDescription('A soma dos pesos passa de 100%.');
      expect(within(dialog).getByLabelText('Fim real')).toHaveAccessibleDescription(
        'O fim real deve ser após o início real.',
      );
      expect(within(dialog).getByLabelText('Status')).toHaveAccessibleDescription('Transição inválida.');
      expect(within(dialog).getByLabelText('Nome da etapa')).toBeInvalid();
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Editar etapa' })).toBeInTheDocument();
    });

    it('400 com campo desconhecido mostra a mensagem em um Alert no diálogo', async () => {
      const dialog = await abrirESalvar(() =>
        HttpResponse.json({ errors: { ObraId: ['Obra inválida.'] } }, { status: 400 }),
      );

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Obra inválida.');
    });

    it('400 sem detalhes mostra a mensagem genérica de dados inválidos', async () => {
      const dialog = await abrirESalvar(() => HttpResponse.json({}, { status: 400 }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Dados inválidos.');
    });

    it('403 mostra Alert de permissão no diálogo e não fecha', async () => {
      const dialog = await abrirESalvar(() => new HttpResponse(null, { status: 403 }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/não tem permissão/i);
      expect(screen.getByRole('dialog', { name: 'Editar etapa' })).toBeInTheDocument();
    });

    it('404 diz que a etapa não foi encontrada', async () => {
      const dialog = await abrirESalvar(() => new HttpResponse(null, { status: 404 }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/etapa não foi encontrada/i);
    });

    it('500 mostra a mensagem e o código de suporte (requestId)', async () => {
      const dialog = await abrirESalvar(() =>
        HttpResponse.json({ requestId: 'req-put-500', message: 'Erro interno do servidor.' }, { status: 500 }),
      );

      const alerta = await within(dialog).findByRole('alert');
      expect(alerta).toHaveTextContent('Erro interno do servidor.');
      expect(alerta).toHaveTextContent('req-put-500');
      expect(screen.getByRole('dialog', { name: 'Editar etapa' })).toBeInTheDocument();
    });

    it('depois de um erro, salvar de novo com sucesso fecha o diálogo', async () => {
      let chamadas = 0;
      server.use(
        getEtapas(cenario()),
        http.put(`${API}/etapas/:id`, () => {
          chamadas += 1;
          return chamadas === 1
            ? HttpResponse.json({ requestId: 'req-1', message: 'Falhou' }, { status: 500 })
            : HttpResponse.json(etapa({ id: 'e2', nome: 'Alvenaria' }));
        }),
      );
      const u = user();
      renderApp(ROTA, 'Admin');

      const dialog = await abrirEdicao(u, 'Alvenaria');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));
      await within(dialog).findByRole('alert');
      await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(chamadas).toBe(2);
    });
  });
});

describe('Gantt editável: criação (+ Etapa)', () => {
  it('abre com ordem = maior + 1, só nome/ordem/peso/previstas e sem status, % nem datas reais', async () => {
    server.use(getEtapas(cenario()));
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });

    expect(within(dialog).getByLabelText('Nome da etapa')).toHaveValue('');
    expect(within(dialog).getByLabelText('Ordem')).toHaveValue(6);
    expect(within(dialog).getByLabelText('Peso (%)')).toHaveValue(0);
    expect(within(dialog).getByLabelText('Início previsto')).toHaveValue('');
    expect(within(dialog).getByLabelText('Fim previsto')).toHaveValue('');
    expect(within(dialog).queryByLabelText('Status')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('% concluído')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Início real')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Fim real')).not.toBeInTheDocument();
  });

  it('obra vazia: ordem padrão 1', async () => {
    server.use(getEtapas([]));
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });
    expect(within(dialog).getByLabelText('Ordem')).toHaveValue(1);
  });

  it('envia POST /etapas só com os campos previstos, fecha e refaz o GET', async () => {
    const { estado, handler } = listaViva(cenario());
    let corpo: unknown;
    server.use(
      handler,
      http.post(`${API}/etapas`, async ({ request }) => {
        corpo = await request.json();
        const nova = etapa({
          id: 'e6',
          nome: 'Instalações',
          ordem: 6,
          percentualPeso: 15,
          dataInicioPrevista: '2027-03-01',
          dataFimPrevista: '2027-04-15',
        });
        estado.lista = [...estado.lista, nova];
        return HttpResponse.json(nova, { status: 201 });
      }),
    );
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });
    await u.type(within(dialog).getByLabelText('Nome da etapa'), 'Instalações');
    await setTexto(u, within(dialog).getByLabelText('Peso (%)'), '15');
    setData(within(dialog).getByLabelText('Início previsto'), '2027-03-01');
    setData(within(dialog).getByLabelText('Fim previsto'), '2027-04-15');
    await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(corpo).toEqual({
      obraId: OBRA_ID,
      nome: 'Instalações',
      ordem: 6,
      percentualPeso: 15,
      dataInicioPrevista: '2027-03-01',
      dataFimPrevista: '2027-04-15',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Etapa "Instalações" criada.');
    await waitFor(() => expect(estado.gets).toBe(2));
    expect(await screen.findByRole('button', { name: 'Editar etapa Instalações' })).toBeInTheDocument();
  });

  it('datas previstas em branco vão como null', async () => {
    let corpo: Record<string, unknown> = {};
    server.use(
      getEtapas([]),
      http.post(`${API}/etapas`, async ({ request }) => {
        corpo = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(etapa({ id: 'e1', nome: 'Primeira' }), { status: 201 });
      }),
    );
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });
    await u.type(within(dialog).getByLabelText('Nome da etapa'), 'Primeira');
    await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(corpo.nome).toBe('Primeira'));
    expect(corpo).toEqual({
      obraId: OBRA_ID,
      nome: 'Primeira',
      ordem: 1,
      percentualPeso: 0,
      dataInicioPrevista: null,
      dataFimPrevista: null,
    });
  });

  it('nome em branco não envia', async () => {
    let posts = 0;
    server.use(
      getEtapas(cenario()),
      http.post(`${API}/etapas`, () => {
        posts += 1;
        return HttpResponse.json(etapa(), { status: 201 });
      }),
    );
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });
    await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(within(dialog).getByLabelText('Nome da etapa')).toBeInvalid());
    expect(posts).toBe(0);
  });

  it('400 do POST vira mensagem no campo', async () => {
    server.use(
      getEtapas(cenario()),
      http.post(`${API}/etapas`, () =>
        HttpResponse.json({ errors: { Ordem: ['Ordem já usada nesta obra.'] } }, { status: 400 }),
      ),
    );
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });
    await u.type(within(dialog).getByLabelText('Nome da etapa'), 'Nova');
    await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Ordem')).toHaveAccessibleDescription('Ordem já usada nesta obra.'),
    );
  });

  it('500 do POST mostra requestId no diálogo', async () => {
    server.use(
      getEtapas(cenario()),
      http.post(`${API}/etapas`, () =>
        HttpResponse.json({ requestId: 'req-post-500', message: 'Erro interno' }, { status: 500 }),
      ),
    );
    const u = user();
    renderApp(ROTA, 'Admin');

    await u.click(await screen.findByRole('button', { name: '+ Etapa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova etapa' });
    await u.type(within(dialog).getByLabelText('Nome da etapa'), 'Nova');
    await u.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('req-post-500');
  });
});

describe('invalidação do cache após salvar', () => {
  it('PUT e POST invalidam gantt, cronograma e etapas da obra (e só dela)', async () => {
    server.use(
      http.put(`${API}/etapas/:id`, () => HttpResponse.json(etapa())),
      http.post(`${API}/etapas`, () => HttpResponse.json(etapa(), { status: 201 })),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const chaves = ['gantt', 'cronograma', 'etapas'] as const;
    // As chaves são as usadas pelos módulos: Gantt (etapas-admin), Cronograma e useEtapas (Projetos/Relatório fotográfico).
    const semear = () => {
      for (const c of chaves) queryClient.setQueryData(['obra', OBRA_ID, c], []);
      queryClient.setQueryData(['obra', 'outra-obra', 'cronograma'], []);
      queryClient.setQueryData(['obra', OBRA_ID, 'projetos'], []);
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSalvarEtapa(OBRA_ID), { wrapper });

    semear();
    await result.current.mutateAsync({
      mode: 'edit',
      id: 'e1',
      body: {
        nome: 'X',
        ordem: 1,
        percentualPeso: 0,
        dataInicioPrevista: null,
        dataFimPrevista: null,
        dataInicioReal: null,
        dataFimReal: null,
        status: 'nao_iniciada',
        percentualConcluido: 0,
      },
    });
    for (const c of chaves) expect(queryClient.getQueryState(['obra', OBRA_ID, c])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['obra', 'outra-obra', 'cronograma'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['obra', OBRA_ID, 'projetos'])?.isInvalidated).toBe(false);

    queryClient.clear();
    semear();
    await result.current.mutateAsync({
      mode: 'create',
      body: {
        obraId: OBRA_ID,
        nome: 'Y',
        ordem: 2,
        percentualPeso: 0,
        dataInicioPrevista: null,
        dataFimPrevista: null,
      },
    });
    for (const c of chaves) expect(queryClient.getQueryState(['obra', OBRA_ID, c])?.isInvalidated).toBe(true);
  });

  it('erro no PUT não invalida nada', async () => {
    server.use(http.put(`${API}/etapas/:id`, () => HttpResponse.json({ message: 'x' }, { status: 500 })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['obra', OBRA_ID, 'cronograma'], []);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSalvarEtapa(OBRA_ID), { wrapper });

    await expect(
      result.current.mutateAsync({
        mode: 'edit',
        id: 'e1',
        body: {
          nome: 'X',
          ordem: 1,
          percentualPeso: 0,
          dataInicioPrevista: null,
          dataFimPrevista: null,
          dataInicioReal: null,
          dataFimReal: null,
          status: 'nao_iniciada',
          percentualConcluido: 0,
        },
      }),
    ).rejects.toThrow();
    expect(queryClient.getQueryState(['obra', OBRA_ID, 'cronograma'])?.isInvalidated).toBe(false);
  });
});
