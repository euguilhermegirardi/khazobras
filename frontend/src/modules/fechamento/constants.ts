import type { MedicaoStatus } from '@/interfaces/medicao';

// O rótulo do tipo de item mora na base (utils/medicaoItem.ts): Medições (admin) usa o mesmo mapa.
export { ITEM_TIPO_LABEL } from '@/utils/medicaoItem';

/** Linguagem simples para o cliente. */
export const MEDICAO_STATUS_LABEL: Record<MedicaoStatus, string> = {
  PendingApproval: 'Aguardando sua aprovação',
  Approved: 'Aprovada',
  InvoiceIssued: 'Nota fiscal emitida',
};

/** Cor do badge por status (mapa de cores: .claude/rules/frontend-design.md). */
export const MEDICAO_STATUS_BADGE: Record<MedicaoStatus, 'warning' | 'success' | 'info'> = {
  PendingApproval: 'warning',
  Approved: 'success',
  InvoiceIssued: 'info',
};
