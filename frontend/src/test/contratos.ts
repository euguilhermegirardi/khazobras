import { http, HttpResponse } from 'msw';
import type { Contrato, ContratoCliente, Pagamento, PagamentoCliente } from '@/interfaces/contrato';
import type { MedicaoResumo } from '@/interfaces/medicao';
import { API } from './server';

/** Dados e API simulada das telas Contratos (cliente e admin). Formato real do backend; dados sintéticos. */
export const OBRA_ID = '22222222-2222-2222-2222-222222222222';
export const CLIENTE = `/cliente/obras/${OBRA_ID}/contratos`;
export const ADMIN = `/admin/obras/${OBRA_ID}/contratos`;

export const contratoCliente = (over: Partial<ContratoCliente> = {}): ContratoCliente => ({
  id: 'c1',
  obraId: OBRA_ID,
  numero: 'CT-2026/01',
  valorContratado: 100000,
  dataAssinatura: '2026-03-15',
  totalPago: 40000,
  saldoAPagar: 60000,
  ...over,
});

export const pagamentoCliente = (over: Partial<PagamentoCliente> = {}): PagamentoCliente => ({
  id: 'p1',
  referenteMedicaoId: null,
  referenteMedicaoNumero: null,
  valor: 40000,
  dataPagamento: '2026-06-01',
  formaPagamento: 'Pix',
  ...over,
});

export const contratoAdmin = (over: Partial<Contrato> = {}): Contrato => ({
  ...contratoCliente(),
  createdAt: '2026-03-16T12:00:00Z',
  updatedAt: '2026-03-17T12:00:00Z',
  ...over,
});

export const pagamentoAdmin = (over: Partial<Pagamento> = {}): Pagamento => ({
  ...pagamentoCliente(),
  contratoId: 'c1',
  createdAt: '2026-06-02T12:00:00Z',
  ...over,
});

export const medicaoNf = (over: Partial<MedicaoResumo> = {}): MedicaoResumo => ({
  id: 'm3',
  obraId: OBRA_ID,
  etapaId: null,
  etapaNome: null,
  numero: 3,
  competencia: '2026-08-01',
  valorTotal: 51890.25,
  status: 'InvoiceIssued',
  quantidadeItens: 2,
  createdAt: '2026-08-27T15:00:00Z',
  approvedAt: '2026-09-01T15:00:00Z',
  nfIssuedAt: '2026-09-05T15:00:00Z',
  nfNumber: 'NF-2026-0187',
  ...over,
});

export const listaHandler = (lista: unknown[]) =>
  http.get(`${API}/obras/${OBRA_ID}/contratos`, () => HttpResponse.json(lista));

export const detalheHandler = (contrato: { id: string }, pagamentos: unknown[]) =>
  http.get(`${API}/contratos/${contrato.id}`, () => HttpResponse.json({ ...contrato, pagamentos }));

export const erroNaLista = (status: number, body: unknown = {}) =>
  http.get(`${API}/obras/${OBRA_ID}/contratos`, () => HttpResponse.json(body as never, { status }));

export const erroNoDetalhe = (contratoId: string, status: number, body: unknown = {}) =>
  http.get(`${API}/contratos/${contratoId}`, () => HttpResponse.json(body as never, { status }));

export const paged = <T>(items: T[]) => ({ totalItems: items.length, pageIndex: 0, pageSize: 100, items });

const centavos = (valor: number) => Math.round(valor * 100);

interface ContratoComPagamentos {
  contrato: Contrato;
  pagamentos: Pagamento[];
}

export interface ServidorAdmin {
  /** Handlers MSW de todas as chamadas da tela (listas, detalhes, medições e os dois POST). */
  handlers: ReturnType<typeof http.get>[];
  chamadas: {
    listas: number;
    medicoes: URLSearchParams[];
    postsContrato: { auth: string; body: Record<string, unknown> }[];
    postsPagamento: { contratoId: string; auth: string; body: Record<string, unknown> }[];
  };
}

/**
 * API em memória: a lista e o detalhe refletem o que foi criado/registrado, e `totalPago`/`saldoAPagar` são
 * recalculados como o backend faz. `medicoes` é a lista de medições com NF emitida do select.
 */
export function servidorAdmin(inicial: ContratoComPagamentos[], medicoes: MedicaoResumo[] = []): ServidorAdmin {
  const estado = inicial.map((e) => ({ contrato: { ...e.contrato }, pagamentos: [...e.pagamentos] }));
  const chamadas: ServidorAdmin['chamadas'] = { listas: 0, medicoes: [], postsContrato: [], postsPagamento: [] };

  const recalcular = (e: ContratoComPagamentos) => {
    const total = e.pagamentos.reduce((soma, p) => soma + centavos(p.valor), 0) / 100;
    e.contrato.totalPago = total;
    e.contrato.saldoAPagar = (centavos(e.contrato.valorContratado) - centavos(total)) / 100;
  };
  estado.forEach(recalcular);

  const handlers = [
    http.get(`${API}/obras/${OBRA_ID}/contratos`, () => {
      chamadas.listas += 1;
      return HttpResponse.json(estado.map((e) => e.contrato));
    }),
    http.get(`${API}/contratos/:id`, ({ params }) => {
      const e = estado.find((x) => x.contrato.id === params.id);
      if (!e) return HttpResponse.json({}, { status: 404 });
      const pagamentos = e.pagamentos.map((p) => ({
        ...p,
        referenteMedicaoNumero: medicoes.find((m) => m.id === p.referenteMedicaoId)?.numero ?? null,
      }));
      return HttpResponse.json({ ...e.contrato, pagamentos });
    }),
    http.get(`${API}/obras/${OBRA_ID}/medicoes/resumo`, ({ request }) => {
      chamadas.medicoes.push(new URL(request.url).searchParams);
      return HttpResponse.json(paged(medicoes));
    }),
    http.post(`${API}/contratos`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown> & {
        numero: string;
        valorContratado: number;
        dataAssinatura: string | null;
      };
      chamadas.postsContrato.push({ auth: request.headers.get('Authorization') ?? '', body });
      const novo: ContratoComPagamentos = {
        contrato: contratoAdmin({
          id: `novo-${chamadas.postsContrato.length}`,
          numero: body.numero,
          valorContratado: body.valorContratado,
          dataAssinatura: body.dataAssinatura,
          totalPago: 0,
          saldoAPagar: body.valorContratado,
        }),
        pagamentos: [],
      };
      estado.push(novo);
      return HttpResponse.json(novo.contrato, { status: 201 });
    }),
    http.post(`${API}/contratos/:id/pagamentos`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown> & {
        valor: number;
        dataPagamento: string;
        formaPagamento: string | null;
        referenteMedicaoId: string | null;
      };
      const contratoId = String(params.id);
      chamadas.postsPagamento.push({ contratoId, auth: request.headers.get('Authorization') ?? '', body });
      const e = estado.find((x) => x.contrato.id === contratoId);
      if (!e) return HttpResponse.json({}, { status: 404 });
      const novo = pagamentoAdmin({
        id: `pag-${chamadas.postsPagamento.length}`,
        contratoId,
        valor: body.valor,
        dataPagamento: body.dataPagamento,
        formaPagamento: body.formaPagamento,
        referenteMedicaoId: body.referenteMedicaoId,
        referenteMedicaoNumero: null,
      });
      e.pagamentos = [novo, ...e.pagamentos].sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento));
      recalcular(e);
      return HttpResponse.json(novo, { status: 201 });
    }),
  ] as ReturnType<typeof http.get>[];

  return { handlers, chamadas };
}
