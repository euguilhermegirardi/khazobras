import type {
  CreateMedicaoRequest,
  IssueInvoiceRequest,
  Medicao,
  MedicaoResumo,
  MedicaoStatusFiltro,
} from '@/interfaces/medicao';
import type { Paged } from '@/interfaces/paged';
import { apiRequest } from '@/services/apiClient';

interface ListParams {
  pageIndex: number;
  pageSize: number;
  status?: MedicaoStatusFiltro;
}

/** Lista de acompanhamento (Admin/Master), mais nova primeiro. `status` opcional em snake_case. */
export const listMedicoesResumo = (
  obraId: string,
  { pageIndex, pageSize, status }: ListParams,
  signal?: AbortSignal,
): Promise<Paged<MedicaoResumo>> => {
  const params = new URLSearchParams({ pageIndex: String(pageIndex), pageSize: String(pageSize) });
  if (status) params.set('status', status);
  return apiRequest<Paged<MedicaoResumo>>(`/obras/${obraId}/medicoes/resumo?${params.toString()}`, { signal });
};

/** Detalhe com itens. O admin também recebe `approvedByUserId`, que a tela ignora (não está no tipo). */
export const getMedicaoAdmin = (medicaoId: string, signal?: AbortSignal): Promise<Medicao> =>
  apiRequest<Medicao>(`/medicoes/${medicaoId}`, { signal });

/** 201 com o detalhe. 400 `{ errors }`, 403, 404, 409 (número repetido na obra). */
export const createMedicao = (body: CreateMedicaoRequest): Promise<Medicao> =>
  apiRequest<Medicao>('/medicoes', { method: 'POST', body });

/** 200 com o detalhe (`InvoiceIssued`). 409 se a medição não está aprovada. */
export const issueInvoice = (medicaoId: string, body: IssueInvoiceRequest): Promise<Medicao> =>
  apiRequest<Medicao>(`/medicoes/${medicaoId}/issue-invoice`, { method: 'POST', body });
