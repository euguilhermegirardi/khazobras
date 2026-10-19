import { apiRequest } from '@/services/apiClient';
import type { Medicao } from '@/interfaces/medicao';

/** Todas as medições da obra (o backend não pagina; devolve a lista com os itens). */
export const listMedicoes = (obraId: string, signal?: AbortSignal): Promise<Medicao[]> =>
  apiRequest<Medicao[]>(`/obras/${obraId}/medicoes`, { signal });

export const getMedicao = (medicaoId: string, signal?: AbortSignal): Promise<Medicao> =>
  apiRequest<Medicao>(`/medicoes/${medicaoId}`, { signal });

/** Única escrita do cliente. 409 se a medição não está mais aguardando aprovação. */
export const approveMedicao = (medicaoId: string): Promise<Medicao> =>
  apiRequest<Medicao>(`/medicoes/${medicaoId}/approve`, { method: 'POST' });
