import type { ObraStatus } from '@/interfaces/obra';

export const OBRA_STATUS_LABEL: Record<ObraStatus, string> = {
  EmAndamento: 'Em andamento',
  Concluida: 'Concluída',
  Pausada: 'Pausada',
};

/** Cor do badge por status (mapa de cores: .claude/rules/frontend-design.md). */
export const OBRA_STATUS_BADGE: Record<ObraStatus, 'info' | 'success' | 'warning'> = {
  EmAndamento: 'info',
  Concluida: 'success',
  Pausada: 'warning',
};
