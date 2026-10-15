import type { ObraStatus } from '@/shared/interfaces/obra'

export const OBRA_STATUS_LABEL: Record<ObraStatus, string> = {
  EmAndamento: 'Em andamento',
  Concluida: 'Concluída',
  Pausada: 'Pausada',
}
