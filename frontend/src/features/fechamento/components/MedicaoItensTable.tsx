import type { MedicaoItem } from '@/shared/interfaces/medicao'
import { formatCurrency, formatQuantity } from '@/shared/lib/format'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ITEM_TIPO_LABEL } from '../constants'

interface MedicaoItensTableProps {
  itens: MedicaoItem[]
  /** Total calculado pelo backend (não somamos no front). */
  valorTotal: number
}

/** Itens da medição (protótipo: docs/design/capturas/medicoes.png), somente leitura. */
export const MedicaoItensTable = ({ itens, valorTotal }: MedicaoItensTableProps) => (
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead>Descrição</TableHead>
        <TableHead>Tipo</TableHead>
        <TableHead className="text-right">Quantidade</TableHead>
        <TableHead className="text-right">Valor unitário</TableHead>
        <TableHead className="text-right">Total</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {itens.map((item) => (
        <TableRow key={item.id}>
          <TableCell>{item.descricao}</TableCell>
          <TableCell className="text-muted-foreground">{ITEM_TIPO_LABEL[item.tipo]}</TableCell>
          <TableCell className="text-right">{formatQuantity(item.quantidade)}</TableCell>
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
)
