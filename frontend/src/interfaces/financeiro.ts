/**
 * `categoria` vem do enum `ItemTipo` do backend (`ToString()` => PascalCase). Os valores em snake_case
 * (formato do request) ficam aqui por segurança: se o backend mudar a serialização, a tela não quebra.
 */
export type LancamentoCategoria =
  | 'MaoDeObra'
  | 'Material'
  | 'Equipamento'
  | 'mao_de_obra'
  | 'material'
  | 'equipamento'

/** Espelha FinanceiroAnexoResponse (comprovante). O arquivo vem de `GET /financeiro/anexos/{id}/download`. */
export interface LancamentoAnexo {
  id: string
  nomeArquivo: string
  contentType?: string | null
  tamanhoBytes?: number | null
  /** Instante ISO 8601. */
  uploadedAt: string
}

/**
 * Espelha FinanceiroLancamentoClienteResponse (visão reduzida do cliente). Não traz
 * `createdByUserId` nem `visivelCliente` de propósito.
 */
export interface LancamentoCliente {
  id: string
  obraId: string
  categoria: LancamentoCategoria
  descricao: string
  valor: number
  /** DATE ("yyyy-MM-dd"). */
  dataLancamento: string
  /** DATE ("yyyy-MM-dd"), sempre o dia 1 do mês de competência. */
  mesCompetencia: string
  anexos: LancamentoAnexo[]
}
