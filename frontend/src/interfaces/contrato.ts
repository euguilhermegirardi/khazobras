/**
 * Visão do CLIENTE: espelha ContratoClienteResponse. Só valor contratado e o que ele pagou; sem `createdAt`,
 * `updatedAt` nem `storageKey`. `dataAssinatura` é DATE ("yyyy-MM-dd"). `saldoAPagar` pode ser negativo (pago a mais).
 */
export interface ContratoCliente {
  id: string;
  obraId: string;
  numero: string;
  valorContratado: number;
  dataAssinatura: string | null;
  totalPago: number;
  saldoAPagar: number;
}

/** Espelha PagamentoClienteResponse (sem `contratoId` nem `createdAt`). `dataPagamento` é DATE. */
export interface PagamentoCliente {
  id: string;
  referenteMedicaoId: string | null;
  referenteMedicaoNumero: number | null;
  valor: number;
  dataPagamento: string;
  formaPagamento: string | null;
}

/** Espelha ContratoDetalheClienteResponse: contrato + pagamentos (data mais recente primeiro). */
export interface ContratoDetalheCliente extends ContratoCliente {
  pagamentos: PagamentoCliente[];
}

/** Visão ADMIN/MASTER: espelha ContratoResponse. `createdAt`/`updatedAt` são ISO 8601. */
export interface Contrato extends ContratoCliente {
  createdAt: string;
  updatedAt: string;
}

/** Espelha PagamentoResponse. No 201 do POST, `referenteMedicaoNumero` vem `null` (só as leituras preenchem). */
export interface Pagamento extends PagamentoCliente {
  contratoId: string;
  createdAt: string;
}

/** Espelha ContratoDetalheResponse. */
export interface ContratoDetalhe extends Contrato {
  pagamentos: Pagamento[];
}

/** Espelha CreateContratoRequest. `dataAssinatura` = "yyyy-MM-dd" ou null. */
export type CreateContratoRequest = {
  obraId: string;
  numero: string;
  valorContratado: number;
  dataAssinatura: string | null;
};

/** Espelha CreatePagamentoRequest. `dataPagamento` = "yyyy-MM-dd". */
export type CreatePagamentoRequest = {
  valor: number;
  dataPagamento: string;
  formaPagamento: string | null;
  referenteMedicaoId: string | null;
};
