export type RelatorioFotograficoTipo = 'mensal' | 'etapa'

/** Espelha FotoResponse. Não traz a chave de storage: a imagem vem de `GET /fotos/{id}/arquivo`. */
export interface Foto {
  id: string
  /** DATE ("yyyy-MM-dd"). */
  dataFoto?: string | null
  descricao?: string | null
  ordem: number
  createdAt: string
}

/** Espelha RelatorioFotograficoResponse. `competencia` (DATE) vale para `mensal`; `etapaId` para `etapa`. */
export interface RelatorioFotografico {
  id: string
  obraId: string
  tipo: RelatorioFotograficoTipo
  etapaId?: string | null
  titulo: string
  competencia?: string | null
  createdAt: string
  fotos: Foto[]
}
