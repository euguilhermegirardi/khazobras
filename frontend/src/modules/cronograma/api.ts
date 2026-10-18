import { apiRequest } from '@/services/apiClient'
import type { EtapaCronograma } from '@/interfaces/etapa'

/** Array puro, ordenado por `ordem` (o backend não pagina). */
export const listEtapasCronograma = (obraId: string, signal?: AbortSignal): Promise<EtapaCronograma[]> =>
  apiRequest<EtapaCronograma[]>(`/obras/${obraId}/etapas`, { signal })
