import type {
  CreateRelatorioMensalRequest,
  RelatorioMensalAdmin,
  RelatorioMensalHistorico,
  RelatorioMensalRequest,
} from '@/interfaces/relatorioMensal';
import { apiRequest } from '@/services/apiClient';

/** Todos os relatórios da obra (rascunhos e publicados), array puro. 403, 404. */
export const listRelatorios = (obraId: string, signal?: AbortSignal): Promise<RelatorioMensalAdmin[]> =>
  apiRequest<RelatorioMensalAdmin[]>(`/obras/${obraId}/relatorios-mensais?onlyPublished=false`, { signal });

/** 200, 403, 404. */
export const getRelatorio = (id: string, signal?: AbortSignal): Promise<RelatorioMensalAdmin> =>
  apiRequest<RelatorioMensalAdmin>(`/relatorios-mensais/${id}`, { signal });

/** 201. 400 `errors.ObraId|Competencia|Conteudo`, 403, 404 (obra), 409 `{ message }` (mês já usado na obra). */
export const createRelatorio = (body: CreateRelatorioMensalRequest): Promise<RelatorioMensalAdmin> =>
  apiRequest<RelatorioMensalAdmin>('/relatorios-mensais', { method: 'POST', body: { ...body } });

/** 200. Só rascunho: 409 `{ message }` se publicado ou se o mês já é de outro relatório. */
export const updateRelatorio = (id: string, body: RelatorioMensalRequest): Promise<RelatorioMensalAdmin> =>
  apiRequest<RelatorioMensalAdmin>(`/relatorios-mensais/${id}`, { method: 'PUT', body: { ...body } });

/** 204. Definitivo; 409 se publicado. */
export const deleteRelatorio = (id: string): Promise<void> =>
  apiRequest<void>(`/relatorios-mensais/${id}`, { method: 'DELETE' });

/** 200, sem corpo. 409 se já publicado. Não existe despublicar. */
export const publishRelatorio = (id: string): Promise<RelatorioMensalAdmin> =>
  apiRequest<RelatorioMensalAdmin>(`/relatorios-mensais/${id}/publish`, { method: 'POST' });

/** Até 100 registros, do mais novo para o mais antigo. */
export const getHistorico = (id: string, signal?: AbortSignal): Promise<RelatorioMensalHistorico[]> =>
  apiRequest<RelatorioMensalHistorico[]>(`/relatorios-mensais/${id}/historico`, { signal });
