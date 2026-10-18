/** Espelha o status do backend (minúsculas, como o banco). */
export type RelatorioMensalStatus = 'draft' | 'published'

/**
 * Espelha RelatorioMensalClienteResponse (visão do cliente, sem `createdByUserId`). `competencia` é DATE ("yyyy-MM-dd"); `publishedAt`/`createdAt` são ISO 8601.
 * `conteudo` é texto puro: nunca renderizar como HTML.
 */
export interface RelatorioMensal {
  id: string
  obraId: string
  competencia: string
  conteudo: string
  status: RelatorioMensalStatus
  publishedAt: string | null
  createdAt: string
}
