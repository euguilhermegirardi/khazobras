import { apiRequest } from '@/services/apiClient'
import type { RelatorioMensal } from '@/interfaces/relatorioMensal'

/** Só os publicados (o cliente nunca vê rascunho). O backend não pagina; devolve array puro. */
export const listRelatoriosMensais = (obraId: string, signal?: AbortSignal): Promise<RelatorioMensal[]> =>
  apiRequest<RelatorioMensal[]>(`/obras/${obraId}/relatorios-mensais?onlyPublished=true`, { signal })
