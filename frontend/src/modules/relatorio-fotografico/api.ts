import { apiRequest } from '@/services/apiClient'
import type { Etapa } from '@/interfaces/etapa'
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico'

/** Array puro, mais novo primeiro (o backend não pagina). */
export const listRelatoriosFotograficos = (obraId: string, signal?: AbortSignal): Promise<RelatorioFotografico[]> =>
  apiRequest<RelatorioFotografico[]>(`/obras/${obraId}/relatorios-fotograficos`, { signal })

/** Só para traduzir `etapaId` em nome. */
export const listEtapas = (obraId: string, signal?: AbortSignal): Promise<Etapa[]> =>
  apiRequest<Etapa[]>(`/obras/${obraId}/etapas`, { signal })
