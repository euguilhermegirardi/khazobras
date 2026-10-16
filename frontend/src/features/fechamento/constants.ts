import type { MedicaoItemTipo, MedicaoStatus } from '@/shared/interfaces/medicao'

/** Linguagem simples para o cliente. */
export const MEDICAO_STATUS_LABEL: Record<MedicaoStatus, string> = {
  PendingApproval: 'Aguardando sua aprovação',
  Approved: 'Aprovada',
  InvoiceIssued: 'Nota fiscal emitida',
}

/** Cor do badge por status (mapa de cores: .claude/rules/frontend-design.md). */
export const MEDICAO_STATUS_BADGE: Record<MedicaoStatus, 'warning' | 'success' | 'info'> = {
  PendingApproval: 'warning',
  Approved: 'success',
  InvoiceIssued: 'info',
}

export const ITEM_TIPO_LABEL: Record<MedicaoItemTipo, string> = {
  MaoDeObra: 'Mão de obra',
  Material: 'Material',
  Equipamento: 'Equipamento',
}
