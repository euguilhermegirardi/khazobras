import type { MedicaoItem } from '@/interfaces/medicao';
import { formatCurrency, formatQuantity } from '@/utils/format';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ITEM_TIPO_LABEL } from '../constants';

interface MedicaoItensTableProps {
  itens: MedicaoItem[];
  /** Total calculado pelo backend (não somamos no front). */
  valorTotal: number;
}

/** Itens da medição (protótipo: docs/design/capturas/medicoes.png), somente leitura. */
export const MedicaoItensTable = ({ itens, valorTotal }: MedicaoItensTableProps) => (
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>Descrição</TableHead>
        <TableHead className="hidden sm:table-cell">Tipo</TableHead>
        <TableHead className="hidden text-right sm:table-cell">Quantidade</TableHead>
        <TableHead className="text-right">Valor unit.</TableHead>
        <TableHead className="text-right">Total</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {itens.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="whitespace-normal">
            {item.descricao}
            <span className="block text-xs text-muted-foreground sm:hidden">
              {ITEM_TIPO_LABEL[item.tipo]} · {formatQuantity(item.quantidade)}
            </span>
          </TableCell>
          <TableCell className="hidden text-muted-foreground sm:table-cell">{ITEM_TIPO_LABEL[item.tipo]}</TableCell>
          <TableCell className="hidden text-right sm:table-cell">{formatQuantity(item.quantidade)}</TableCell>
          <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
          <TableCell className="text-right font-medium">{formatCurrency(item.valorTotal)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
    <TableFooter>
      <TableRow className="hover:bg-muted">
        <TableCell colSpan={4} className="text-right">
          Total da medição
        </TableCell>
        <TableCell className="text-right">{formatCurrency(valorTotal)}</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
