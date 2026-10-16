import type { MedicaoStatus } from '@/shared/interfaces/medicao'
import { Badge } from '@/shared/ui/badge'
import { MEDICAO_STATUS_BADGE, MEDICAO_STATUS_LABEL } from '../constants'

interface MedicaoStatusBadgeProps {
  status: MedicaoStatus
}

export const MedicaoStatusBadge = ({ status }: MedicaoStatusBadgeProps) => (
  <Badge variant={MEDICAO_STATUS_BADGE[status]}>{MEDICAO_STATUS_LABEL[status]}</Badge>
)
