import { apiRequest } from '@/services/apiClient';
import type { EtapaCreateRequest, EtapaCronograma, EtapaUpdateRequest } from '@/interfaces/etapa';

/** Array puro, ordenado por `ordem` (o backend não pagina). */
export const listEtapas = (obraId: string, signal?: AbortSignal): Promise<EtapaCronograma[]> =>
  apiRequest<EtapaCronograma[]>(`/obras/${obraId}/etapas`, { signal });

/** 201 com a etapa criada (sempre 0% e `nao_iniciada`). */
export const createEtapa = (body: EtapaCreateRequest): Promise<EtapaCronograma> =>
  apiRequest<EtapaCronograma>('/etapas', { method: 'POST', body });

/** 200 com a etapa atualizada. */
export const updateEtapa = (id: string, body: EtapaUpdateRequest): Promise<EtapaCronograma> =>
  apiRequest<EtapaCronograma>(`/etapas/${id}`, { method: 'PUT', body });
