/** Espelha MedicaoStatus do backend (resposta em PascalCase). */
export type MedicaoStatus = 'PendingApproval' | 'Approved' | 'InvoiceIssued'

/** Espelha ItemTipo do backend (resposta em PascalCase). */
export type MedicaoItemTipo = 'MaoDeObra' | 'Material' | 'Equipamento'

/** Espelha MedicaoItemResponse. Valores são os contratados (nunca custo real). */
export interface MedicaoItem {
  id: string
  tipo: MedicaoItemTipo
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

/**
 * Espelha MedicaoResponse, sem `approvedByUserId` (id interno que o backend ainda devolve ao cliente;
 * ver PLAN-09). `competencia` é DATE ("yyyy-MM-dd"); `approvedAt`/`nfIssuedAt`/`createdAt` são ISO 8601.
 */
export interface Medicao {
  id: string
  obraId: string
  etapaId: string | null
  numero: number
  competencia: string
  valorTotal: number
  status: MedicaoStatus
  approvedAt: string | null
  nfNumber: string | null
  nfIssuedAt: string | null
  createdAt: string
  itens: MedicaoItem[]
}
