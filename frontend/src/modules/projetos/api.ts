import type { ProjetoDocumento } from '@/interfaces/projeto'
import { apiDownload, apiRequest } from '@/services/apiClient'

/** Array puro (o backend não pagina), já ordenado por etapa, sem etapa por último, depois mais novo primeiro. */
export const listProjetos = (obraId: string, signal?: AbortSignal): Promise<ProjetoDocumento[]> =>
  apiRequest<ProjetoDocumento[]>(`/obras/${obraId}/projetos`, { signal })

/** Baixa o arquivo pela API (Bearer -> blob). O nome do Content-Disposition tem prioridade. */
export const downloadProjeto = async (projeto: ProjetoDocumento): Promise<{ blob: Blob; fileName: string }> => {
  const { blob, fileName } = await apiDownload(`/projetos/${projeto.id}/download`)
  return { blob, fileName: fileName ?? projeto.nome }
}
