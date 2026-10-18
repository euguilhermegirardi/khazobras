import { apiRequest } from '@/shared/lib/apiClient'
import type { RelatorioMensal } from '@/shared/interfaces/relatorioMensal'

/** Só os publicados (o cliente nunca vê rascunho). O backend não pagina; devolve array puro. */
export const listRelatoriosMensais = (obraId: string, signal?: AbortSignal): Promise<RelatorioMensal[]> =>
  apiRequest<RelatorioMensal[]>(`/obras/${obraId}/relatorios-mensais?onlyPublished=true`, { signal })
