import type {
  Contrato,
  ContratoDetalhe,
  CreateContratoRequest,
  CreatePagamentoRequest,
  Pagamento,
} from '@/interfaces/contrato';
import type { MedicaoResumo } from '@/interfaces/medicao';
import type { Paged } from '@/interfaces/paged';
import { apiRequest } from '@/services/apiClient';

/** Medições que podem ser vinculadas a um pagamento: só as com NF emitida (regra do backend). */
export const MEDICOES_COM_NF_PAGE_SIZE = 100;

/** Array puro (sem paginação), mais antigo primeiro. */
export const listContratosAdmin = (obraId: string, signal?: AbortSignal): Promise<Contrato[]> =>
  apiRequest<Contrato[]>(`/obras/${obraId}/contratos`, { signal });

/** Contrato + pagamentos (data mais recente primeiro). */
export const getContratoAdmin = (contratoId: string, signal?: AbortSignal): Promise<ContratoDetalhe> =>
  apiRequest<ContratoDetalhe>(`/contratos/${contratoId}`, { signal });

/** 201 com o contrato. 400 `{ errors }`, 403, 404, 409 (número repetido na obra). */
export const createContrato = (body: CreateContratoRequest): Promise<Contrato> =>
  apiRequest<Contrato>('/contratos', { method: 'POST', body });

/** 201 com o pagamento (`referenteMedicaoNumero` vem null; a lista do detalhe traz o número). 400, 403, 404. */
export const createPagamento = (contratoId: string, body: CreatePagamentoRequest): Promise<Pagamento> =>
  apiRequest<Pagamento>(`/contratos/${contratoId}/pagamentos`, { method: 'POST', body });

/** Primeira página (mais novas primeiro) das medições com NF emitida da obra, para o seletor do pagamento. */
export const listMedicoesComNf = (obraId: string, signal?: AbortSignal): Promise<Paged<MedicaoResumo>> => {
  const params = new URLSearchParams({
    status: 'invoice_issued',
    pageIndex: '0',
    pageSize: String(MEDICOES_COM_NF_PAGE_SIZE),
  });
  return apiRequest<Paged<MedicaoResumo>>(`/obras/${obraId}/medicoes/resumo?${params.toString()}`, { signal });
};
