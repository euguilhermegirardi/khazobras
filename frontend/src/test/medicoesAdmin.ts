import { http, HttpResponse } from 'msw';
import type { Medicao, MedicaoItem, MedicaoResumo, MedicaoStatus, MedicaoStatusFiltro } from '@/interfaces/medicao';
import { API } from './server';

/** Dados e API simulada da tela Medições (admin). Formato real do backend; dados sintéticos. */
export const OBRA_ID = '22222222-2222-2222-2222-222222222222';
export const OUTRA_OBRA_ID = '99999999-9999-9999-9999-999999999999';
/** Id interno de quem aprovou: o backend manda ao admin; a tela nunca pode exibi-lo. */
export const APPROVER_ID = '77777777-7777-7777-7777-777777777777';

export const LISTA = `/admin/obras/${OBRA_ID}/medicoes`;
export const DETALHE = (id: string) => `/admin/obras/${OBRA_ID}/medicoes/${id}`;

export const STATUS_FILTRO: Record<MedicaoStatusFiltro, MedicaoStatus> = {
  pending_approval: 'PendingApproval',
  approved: 'Approved',
  invoice_issued: 'InvoiceIssued',
};

export const resumo = (over: Partial<MedicaoResumo> = {}): MedicaoResumo => ({
  id: 'm1',
  obraId: OBRA_ID,
  etapaId: null,
  etapaNome: null,
  numero: 1,
  competencia: '2026-08-01',
  valorTotal: 1000,
  status: 'PendingApproval',
  quantidadeItens: 1,
  createdAt: '2026-08-10T15:00:00Z',
  approvedAt: null,
  nfIssuedAt: null,
  nfNumber: null,
  ...over,
});

export const item = (over: Partial<MedicaoItem> = {}): MedicaoItem => ({
  id: 'i1',
  tipo: 'Material',
  descricao: 'Cimento CP-II',
  quantidade: 10,
  valorUnitario: 35.5,
  valorTotal: 355,
  ...over,
});

export const medicao = (over: Partial<Medicao> = {}): Medicao => ({
  id: 'm1',
  obraId: OBRA_ID,
  etapaId: null,
  numero: 1,
  competencia: '2026-08-01',
  valorTotal: 355,
  status: 'PendingApproval',
  approvedAt: null,
  nfNumber: null,
  nfIssuedAt: null,
  createdAt: '2026-08-10T15:00:00Z',
  itens: [item()],
  ...over,
});

export const paged = <T>(items: T[], pageIndex = 0, pageSize = 20, totalItems = items.length) => ({
  totalItems,
  pageIndex,
  pageSize,
  items,
});

export interface ResumoApi {
  /** Handler MSW de `GET /obras/{id}/medicoes/resumo`. */
  handler: ReturnType<typeof http.get>;
  /** Query string de cada chamada, na ordem. */
  chamadas: URLSearchParams[];
  /** Muda a lista que o "servidor" devolve (simula a criação de uma medição). */
  definir: (lista: MedicaoResumo[]) => void;
}

interface ResumoOpcoes {
  /** Status (snake_case) cuja consulta responde 500, para provar que o KPI falha sozinho. */
  falhaNoStatus?: MedicaoStatusFiltro | 'todas';
  /** Responde com este erro em toda chamada. */
  erro?: { status: number; body: unknown };
}

/**
 * Simula a lista de acompanhamento: respeita `status`, `pageIndex` e `pageSize` e devolve `totalItems`
 * do filtro, como o backend. A lista recebida já deve estar na ordem do servidor (mais nova primeiro).
 */
export function resumoApi(inicial: MedicaoResumo[], opcoes: ResumoOpcoes = {}): ResumoApi {
  let lista = inicial;
  const chamadas: URLSearchParams[] = [];
  const handler = http.get(`${API}/obras/${OBRA_ID}/medicoes/resumo`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    chamadas.push(params);
    if (opcoes.erro) return HttpResponse.json(opcoes.erro.body as never, { status: opcoes.erro.status });
    const status = params.get('status') as MedicaoStatusFiltro | null;
    // Só as consultas de KPI (pageSize=1) falham; a tabela (pageSize=20) segue respondendo.
    if (opcoes.falhaNoStatus && params.get('pageSize') === '1' && (status ?? 'todas') === opcoes.falhaNoStatus) {
      return HttpResponse.json({ requestId: 'req-kpi', message: 'Erro interno do servidor.' }, { status: 500 });
    }
    const filtrada = status ? lista.filter((m) => m.status === STATUS_FILTRO[status]) : lista;
    const pageIndex = Number(params.get('pageIndex') ?? 0);
    const pageSize = Number(params.get('pageSize') ?? 20);
    const fatia = filtrada.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    return HttpResponse.json(paged(fatia, pageIndex, pageSize, filtrada.length));
  });
  return {
    handler,
    chamadas,
    definir: (nova) => {
      lista = nova;
    },
  };
}

/** Chamadas de lista (as de `pageSize` 20) separadas das dos KPIs (`pageSize=1`). */
export const chamadasDaTabela = (chamadas: URLSearchParams[]) => chamadas.filter((c) => c.get('pageSize') !== '1');
export const chamadasDosKpis = (chamadas: URLSearchParams[]) => chamadas.filter((c) => c.get('pageSize') === '1');

export const etapasApi = (etapas: { id: string; nome: string }[]) =>
  http.get(`${API}/obras/${OBRA_ID}/etapas`, () =>
    HttpResponse.json(
      etapas.map((e, i) => ({
        ...e,
        obraId: OBRA_ID,
        ordem: i + 1,
        percentualPeso: 10,
        dataInicioPrevista: '2026-03-01',
        dataFimPrevista: '2026-04-30',
        dataInicioReal: null,
        dataFimReal: null,
        status: 'nao_iniciada',
        percentualConcluido: 0,
        createdAt: '2026-01-10T12:00:00Z',
      })),
    ),
  );

export const etapasComErro = () =>
  http.get(`${API}/obras/${OBRA_ID}/etapas`, () =>
    HttpResponse.json({ requestId: 'req-etapas', message: 'Erro interno do servidor.' }, { status: 500 }),
  );

/** `GET /medicoes/{id}` devolvendo o detalhe completo do admin (inclui `approvedByUserId`). */
export const detalheApi = (m: Medicao) =>
  http.get(`${API}/medicoes/${m.id}`, () => HttpResponse.json({ ...m, approvedByUserId: APPROVER_ID }));
