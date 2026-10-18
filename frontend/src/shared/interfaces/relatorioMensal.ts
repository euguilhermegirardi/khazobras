/** Espelha o status do backend (minúsculas, como o banco). */
export type RelatorioMensalStatus = 'draft' | 'published'

/**
 * Espelha RelatorioMensalResponse, sem `createdByUserId` (id interno que o backend ainda devolve ao cliente;
 * ver PLAN-09). `competencia` é DATE ("yyyy-MM-dd"); `publishedAt`/`createdAt` são ISO 8601.
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
