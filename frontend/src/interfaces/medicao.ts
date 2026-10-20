/** Espelha MedicaoStatus do backend (resposta em PascalCase). */
export type MedicaoStatus = 'PendingApproval' | 'Approved' | 'InvoiceIssued';

/** Valor do filtro `status` da lista admin (request em snake_case). */
export type MedicaoStatusFiltro = 'pending_approval' | 'approved' | 'invoice_issued';

/** Espelha ItemTipo do backend (resposta em PascalCase). */
export type MedicaoItemTipo = 'MaoDeObra' | 'Material' | 'Equipamento';

/** ItemTipo no request (snake_case). */
export type MedicaoItemTipoRequest = 'mao_de_obra' | 'material' | 'equipamento';

/** Espelha MedicaoItemResponse. Valores são os contratados/cobrados do cliente (nunca custo real). */
export interface MedicaoItem {
  id: string;
  tipo: MedicaoItemTipo;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

/**
 * Espelha MedicaoClienteResponse (= MedicaoResponse sem `approvedByUserId`). O backend omite esse id interno
 * para o cliente; Admin/Master ainda o recebem, mas nenhuma tela o lê, então ele nem entra no tipo.
 * `competencia` é DATE ("yyyy-MM-dd"); `approvedAt`/`nfIssuedAt`/`createdAt` são ISO 8601.
 */
export interface Medicao {
  id: string;
  obraId: string;
  etapaId: string | null;
  numero: number;
  competencia: string;
  valorTotal: number;
  status: MedicaoStatus;
  approvedAt: string | null;
  nfNumber: string | null;
  nfIssuedAt: string | null;
  createdAt: string;
  itens: MedicaoItem[];
}

/** Espelha MedicaoResumoResponse: linha da lista de acompanhamento do admin (sem itens). */
export interface MedicaoResumo {
  id: string;
  obraId: string;
  etapaId: string | null;
  etapaNome: string | null;
  numero: number;
  competencia: string;
  valorTotal: number;
  status: MedicaoStatus;
  quantidadeItens: number;
  createdAt: string;
  approvedAt: string | null;
  nfIssuedAt: string | null;
  nfNumber: string | null;
}

/** Espelha CreateMedicaoItemRequest. Não há total: o servidor calcula. */
export type CreateMedicaoItemRequest = {
  tipo: MedicaoItemTipoRequest;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

/** Espelha CreateMedicaoRequest. `competencia` = "yyyy-MM-dd" (dia 1 do mês). */
export type CreateMedicaoRequest = {
  obraId: string;
  etapaId: string | null;
  numero: number;
  competencia: string;
  itens: CreateMedicaoItemRequest[];
};

/** Espelha IssueInvoiceRequest. */
export type IssueInvoiceRequest = {
  nfNumber: string;
};
