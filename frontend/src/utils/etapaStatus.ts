export type EtapaTone = 'success' | 'info' | 'neutral';

export const STATUS_NAO_INICIADA = 'nao_iniciada';
export const STATUS_EM_ANDAMENTO = 'em_andamento';
export const STATUS_CONCLUIDA = 'concluida';

/** Rótulo e cor por status (mapa de status do guia de design). Usado pelo Cronograma (cliente) e pelo Gantt (admin). */
export const ETAPA_STATUS: Record<string, { label: string; tone: EtapaTone }> = {
  [STATUS_NAO_INICIADA]: { label: 'Não iniciada', tone: 'neutral' },
  [STATUS_EM_ANDAMENTO]: { label: 'Em andamento', tone: 'info' },
  [STATUS_CONCLUIDA]: { label: 'Concluída', tone: 'success' },
};

/** Status desconhecido: neutro com o texto cru. */
export function etapaStatusInfo(status: string): { label: string; tone: EtapaTone } {
  return ETAPA_STATUS[status] ?? { label: status, tone: 'neutral' };
}
