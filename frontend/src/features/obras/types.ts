/** Espelha ObraStatus do backend (resposta em PascalCase). */
export type ObraStatus = 'EmAndamento' | 'Concluida' | 'Pausada'

export const OBRA_STATUS_LABEL: Record<ObraStatus, string> = {
  EmAndamento: 'Em andamento',
  Concluida: 'Concluída',
  Pausada: 'Pausada',
}

/** Espelha ObraResponse. Datas DATE chegam como "yyyy-MM-dd". */
export interface Obra {
  id: string
  nome: string
  endereco: string | null
  valorContratado: number
  dataInicio: string | null
  dataPrevisaoTermino: string | null
  status: ObraStatus
  createdAt: string
}

/** Listagens paginadas: pageIndex base 0. */
export interface Paged<T> {
  totalItems: number
  pageIndex: number
  pageSize: number
  items: T[]
}
