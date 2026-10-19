import type { LancamentoAnexo, LancamentoCliente } from '@/interfaces/financeiro';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatDateOnly, formatMonthYearTitle } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { CATEGORIA_LABEL } from '../constants';
import { ComprovanteButton } from './ComprovanteButton';

interface LancamentoLinhaProps {
  lancamento: LancamentoCliente;
  /** Id do comprovante em download (null = nenhum). */
  baixandoId: string | null;
  onDownload: (anexo: LancamentoAnexo) => void;
}

export const LancamentoLinha = ({ lancamento, baixandoId, onDownload }: LancamentoLinhaProps) => (
  <TableRow>
    <TableCell className="whitespace-nowrap">{formatDateOnly(lancamento.dataLancamento)}</TableCell>
    <TableCell className="whitespace-nowrap text-muted-foreground">
      {formatMonthYearTitle(lancamento.mesCompetencia)}
    </TableCell>
    <TableCell>
      <Badge variant="neutral">{CATEGORIA_LABEL[lancamento.categoria] ?? lancamento.categoria}</Badge>
    </TableCell>
    <TableCell className="font-medium">{lancamento.descricao}</TableCell>
    <TableCell className="text-right whitespace-nowrap tabular-nums">{formatCurrency(lancamento.valor)}</TableCell>
    <TableCell>
      {/* Mesma altura (h-7 = botão do clipe) com ou sem anexo, para as linhas ficarem iguais */}
      <div className="flex h-7 items-center gap-0.5">
        {lancamento.anexos.length === 0 ? (
          <span className="px-2 text-muted-foreground" aria-label="Sem comprovante">
            —
          </span>
        ) : (
          lancamento.anexos.map((anexo) => (
            <ComprovanteButton
              key={anexo.id}
              anexo={anexo}
              baixando={baixandoId === anexo.id}
              onDownload={onDownload}
            />
          ))
        )}
      </div>
    </TableCell>
  </TableRow>
);
