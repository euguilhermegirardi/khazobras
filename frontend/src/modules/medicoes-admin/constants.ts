import type { MedicaoItemTipoRequest, MedicaoStatus, MedicaoStatusFiltro } from '@/interfaces/medicao';

export { ITEM_TIPO_LABEL } from '@/utils/medicaoItem';

/** Itens por página da lista de acompanhamento. */
export const PAGE_SIZE = 20;

/** Limite de itens por medição (CreateMedicaoRequestValidator). */
export const MAX_ITENS = 200;

/** Vocabulário do admin (o cliente vê outros textos no Fechamento). */
export const MEDICAO_STATUS_LABEL: Record<MedicaoStatus, string> = {
  PendingApproval: 'Aguardando aprovação do cliente',
  Approved: 'Aprovada — emitir NF',
  InvoiceIssued: 'NF emitida',
};

/** Cor do badge por status (mapa de cores: .claude/rules/frontend-design.md). */
export const MEDICAO_STATUS_BADGE: Record<MedicaoStatus, 'warning' | 'success' | 'info'> = {
  PendingApproval: 'warning',
  Approved: 'success',
  InvoiceIssued: 'info',
};

export const STATUS_FILTRO_OPCOES: { value: '' | MedicaoStatusFiltro; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'pending_approval', label: MEDICAO_STATUS_LABEL.PendingApproval },
  { value: 'approved', label: MEDICAO_STATUS_LABEL.Approved },
  { value: 'invoice_issued', label: MEDICAO_STATUS_LABEL.InvoiceIssued },
];

export const ITEM_TIPO_OPCOES: { value: MedicaoItemTipoRequest; label: string }[] = [
  { value: 'mao_de_obra', label: 'Mão de obra' },
  { value: 'material', label: 'Material' },
  { value: 'equipamento', label: 'Equipamento' },
];

/** Grade das linhas de item do formulário; o cabeçalho usa a mesma, para as colunas alinharem. */
export const ITEM_GRID = 'grid grid-cols-[9rem_minmax(0,1fr)_6rem_8rem_8rem_2rem] items-center gap-2';

export const TEXTO_AGUARDANDO_CLIENTE =
  'Aguardando aprovação do cliente. A emissão da NF só é liberada depois que o cliente aprovar a medição.';
