/** Espelha ObraStatus do backend (resposta em PascalCase). */
export type ObraStatus = 'EmAndamento' | 'Concluida' | 'Pausada'

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
