import type { MedicaoItem } from '@/interfaces/medicao';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatQuantity } from '@/utils/format';
import { ITEM_TIPO_LABEL } from '../constants';

interface MedicaoItensTabelaProps {
  itens: MedicaoItem[];
  /** Total calculado pelo backend (não somamos no front). */
  valorTotal: number;
}

/** Itens da medição (protótipo: docs/design/capturas/medicoes.png), somente leitura. */
export const MedicaoItensTabela = ({ itens, valorTotal }: MedicaoItensTabelaProps) => (
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>Tipo</TableHead>
        <TableHead>Descrição</TableHead>
        <TableHead className="text-right">Quantidade</TableHead>
        <TableHead className="text-right">Valor unit.</TableHead>
        <TableHead className="text-right">Total</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {itens.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="whitespace-nowrap text-muted-foreground">{ITEM_TIPO_LABEL[item.tipo]}</TableCell>
          <TableCell className="whitespace-normal">{item.descricao}</TableCell>
          <TableCell className="text-right tabular-nums">{formatQuantity(item.quantidade)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatCurrency(item.valorUnitario)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.valorTotal)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
    <TableFooter>
      <TableRow className="hover:bg-muted">
        <TableCell colSpan={4} className="text-right">
          Total da medição
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(valorTotal)}</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
