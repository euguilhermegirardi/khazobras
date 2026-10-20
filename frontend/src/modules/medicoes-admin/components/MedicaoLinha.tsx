import { Link } from 'react-router-dom';
import type { MedicaoResumo } from '@/interfaces/medicao';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { MedicaoStatusBadge } from './MedicaoStatusBadge';

interface MedicaoLinhaProps {
  medicao: MedicaoResumo;
  /** Destino do detalhe da medição. */
  to: string;
}

const SEM_VALOR = '—';
const dataOuTraco = (valor: string | null) => (valor ? formatTimestamp(valor) : SEM_VALOR);

/** Linha da lista de acompanhamento. O número é o link para o detalhe. */
export const MedicaoLinha = ({ medicao, to }: MedicaoLinhaProps) => (
  <TableRow>
    <TableCell className="font-medium">
      <Link
        to={to}
        aria-label={`Abrir medição ${medicao.numero}`}
        className="text-info underline-offset-4 hover:underline"
      >
        {medicao.numero}
      </Link>
    </TableCell>
    <TableCell className="whitespace-nowrap">{formatMonthYearTitle(medicao.competencia)}</TableCell>
    <TableCell className="max-w-44 truncate text-muted-foreground" title={medicao.etapaNome ?? undefined}>
      {medicao.etapaNome ?? SEM_VALOR}
    </TableCell>
    <TableCell className="text-right">{medicao.quantidadeItens}</TableCell>
    <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
      {formatCurrency(medicao.valorTotal)}
    </TableCell>
    <TableCell>
      <MedicaoStatusBadge status={medicao.status} />
    </TableCell>
    <TableCell className="whitespace-nowrap text-muted-foreground">{medicao.nfNumber ?? SEM_VALOR}</TableCell>
    <TableCell className="whitespace-nowrap text-muted-foreground">{formatTimestamp(medicao.createdAt)}</TableCell>
    <TableCell className="whitespace-nowrap text-muted-foreground">{dataOuTraco(medicao.approvedAt)}</TableCell>
    <TableCell className="whitespace-nowrap text-muted-foreground">{dataOuTraco(medicao.nfIssuedAt)}</TableCell>
  </TableRow>
);
