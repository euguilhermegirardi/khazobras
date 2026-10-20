import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DashboardSerieMes } from '@/interfaces/dashboard';
import { formatMonthYearTitle } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { NOME_BARRA, NOME_LINHA } from '../constants';

interface CustoAcumuladoTabelaProps {
  serie: DashboardSerieMes[];
}

/** Alternativa acessível ao gráfico (leitor de tela): escondida só visualmente (`sr-only`), mesmos números. */
export const CustoAcumuladoTabela = ({ serie }: CustoAcumuladoTabelaProps) => (
  <div className="sr-only">
    <Table>
      <TableCaption>Custo acumulado por mês (medições aprovadas)</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Mês</TableHead>
          <TableHead scope="col">{NOME_BARRA}</TableHead>
          <TableHead scope="col">{NOME_LINHA}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {serie.map((mes) => (
          <TableRow key={mes.competencia}>
            <TableCell>{formatMonthYearTitle(mes.competencia)}</TableCell>
            <TableCell>{formatCurrency(mes.valorMedido)}</TableCell>
            <TableCell>{formatCurrency(mes.valorMedidoAcumulado)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
