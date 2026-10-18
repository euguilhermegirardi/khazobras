import type { MedicaoStatus } from '@/interfaces/medicao'
import { Badge } from '@/components/ui/badge'
import { MEDICAO_STATUS_BADGE, MEDICAO_STATUS_LABEL } from '../constants'

interface MedicaoStatusBadgeProps {
  status: MedicaoStatus
}

export const MedicaoStatusBadge = ({ status }: MedicaoStatusBadgeProps) => (
  <Badge variant={MEDICAO_STATUS_BADGE[status]}>{MEDICAO_STATUS_LABEL[status]}</Badge>
)
