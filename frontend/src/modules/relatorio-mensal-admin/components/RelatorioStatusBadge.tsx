import { Badge } from '@/components/ui/badge';
import type { RelatorioMensalStatus } from '@/interfaces/relatorioMensal';
import { STATUS_BADGE, STATUS_LABEL } from '../constants';

interface RelatorioStatusBadgeProps {
  status: RelatorioMensalStatus;
}

/** Rascunho (cinza) ou Publicado (verde), pelo mapa de status do design. */
export const RelatorioStatusBadge = ({ status }: RelatorioStatusBadgeProps) => (
  <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
);
