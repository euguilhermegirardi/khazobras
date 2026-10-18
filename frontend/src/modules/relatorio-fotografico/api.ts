import { apiRequest } from '@/services/apiClient'
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico'

/** Array puro, mais novo primeiro (o backend não pagina). */
export const listRelatoriosFotograficos = (obraId: string, signal?: AbortSignal): Promise<RelatorioFotografico[]> =>
  apiRequest<RelatorioFotografico[]>(`/obras/${obraId}/relatorios-fotograficos`, { signal })
