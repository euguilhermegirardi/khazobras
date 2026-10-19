import { Link } from 'react-router-dom';
import type { Medicao } from '@/interfaces/medicao';
import { formatMonthYear } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { MedicaoStatusBadge } from './MedicaoStatusBadge';

interface MedicaoLinhaResumoProps {
  medicao: Medicao;
  /** Destino da tela com os itens da medição. */
  to: string;
}

export const MedicaoLinhaResumo = ({ medicao, to }: MedicaoLinhaResumoProps) => (
  <TableRow>
    <TableCell className="font-medium">
      Medição {medicao.numero}
      <span className="block text-xs font-normal text-muted-foreground sm:hidden">
        {formatMonthYear(medicao.competencia)}
      </span>
    </TableCell>
    <TableCell className="hidden text-muted-foreground sm:table-cell">{formatMonthYear(medicao.competencia)}</TableCell>
    <TableCell className="text-right">{formatCurrency(medicao.valorTotal)}</TableCell>
    <TableCell>
      <MedicaoStatusBadge status={medicao.status} />
    </TableCell>
    <TableCell className="text-right">
      <Button asChild variant="outline" size="sm">
        <Link to={to} aria-label={`Ver itens da medição ${medicao.numero}`}>
          Ver itens
        </Link>
      </Button>
    </TableCell>
  </TableRow>
);
