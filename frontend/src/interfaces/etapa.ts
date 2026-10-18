/** Só os campos que as telas do cliente usam de EtapaResponse. */
export interface Etapa {
  id: string
  obraId: string
  nome: string
  ordem: number
}

/** EtapaResponse completa (Cronograma). Datas "yyyy-MM-dd" ou null; `status` em snake_case (`nao_iniciada`...). */
export interface EtapaCronograma extends Etapa {
  percentualPeso: number
  dataInicioPrevista: string | null
  dataInicioReal: string | null
  dataFimPrevista: string | null
  dataFimReal: string | null
  status: string
  createdAt: string
}
