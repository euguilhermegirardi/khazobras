import { Pencil } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { etapaStatusInfo } from '@/utils/etapaStatus';
import { formatPercent } from '@/utils/format';
import { formatPeriodo } from '../format';

interface EtapaGanttLinhaProps {
  etapa: EtapaCronograma;
  onEdit: (etapa: EtapaCronograma) => void;
}

/** Uma linha da tabela do Gantt editável (protótipo: #, Etapa, previsto, % exec., status, peso). */
export const EtapaGanttLinha = ({ etapa, onEdit }: EtapaGanttLinhaProps) => {
  // Constants derivadas
  const { label, tone } = etapaStatusInfo(etapa.status);

  // Functions
  const handleEdit = () => onEdit(etapa);

  // Return
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">{etapa.ordem}</TableCell>
      <TableCell className="max-w-64 truncate font-medium" title={etapa.nome}>
        {etapa.nome}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatPeriodo(etapa.dataInicioPrevista, etapa.dataFimPrevista)}
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatPeriodo(etapa.dataInicioReal, etapa.dataFimReal)}</TableCell>
      <TableCell className="w-36">
        <ProgressBar label={`% concluído de ${etapa.nome}`} value={etapa.percentualConcluido} tone={tone} hideLabel />
      </TableCell>
      <TableCell>
        <Badge variant={tone}>{label}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatPercent(etapa.percentualPeso)}</TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleEdit}
          aria-label={`Editar etapa ${etapa.nome}`}
        >
          <Pencil aria-hidden />
          Editar
        </Button>
      </TableCell>
    </TableRow>
  );
};
