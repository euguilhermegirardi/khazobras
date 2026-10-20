import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PagamentoCliente } from '@/interfaces/contrato';
import { formatDateOnly } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

interface PagamentosTabelaProps {
  /** Aceita também o `Pagamento` do admin (que só acrescenta campos). */
  pagamentos: PagamentoCliente[];
}

const SEM_VALOR = '—';

/** Pagamentos de um contrato (protótipo: docs/design/capturas/pagamentos.png). Mesma tabela para cliente e admin. */
export const PagamentosTabela = ({ pagamentos }: PagamentosTabelaProps) => (
  <Table className="table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
    {/* Data (dd/mm/aaaa ~75px), Valor (até R$ 999.999.999.999,99 ~155px) e Medição ("Medição nº 100000" ~125px) fixos;
        a Forma (texto livre, até 50 caracteres) leva o resto e trunca com title. */}
    <colgroup>
      <col className="w-28" />
      <col className="w-44" />
      <col />
      <col className="w-40" />
    </colgroup>
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>Data</TableHead>
        <TableHead className="text-right">Valor</TableHead>
        <TableHead>Forma</TableHead>
        <TableHead>Medição</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {pagamentos.map((pagamento) => (
        <TableRow key={pagamento.id}>
          <TableCell className="whitespace-nowrap">{formatDateOnly(pagamento.dataPagamento)}</TableCell>
          <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
            {formatCurrency(pagamento.valor)}
          </TableCell>
          <TableCell className="truncate text-muted-foreground" title={pagamento.formaPagamento ?? undefined}>
            {pagamento.formaPagamento ?? SEM_VALOR}
          </TableCell>
          <TableCell className="whitespace-nowrap text-muted-foreground">
            {pagamento.referenteMedicaoNumero === null ? SEM_VALOR : `Medição nº ${pagamento.referenteMedicaoNumero}`}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
