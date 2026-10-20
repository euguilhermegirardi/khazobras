import type { MedicaoResumo } from '@/interfaces/medicao';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MedicaoLinha } from './MedicaoLinha';

interface MedicoesTabelaProps {
  obraId: string;
  medicoes: MedicaoResumo[];
}

/** Tabela de acompanhamento (protótipo: docs/design/capturas/medicoes.png, dentro de um Card). */
export const MedicoesTabela = ({ obraId, medicoes }: MedicoesTabelaProps) => (
  <Card>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nº</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Itens</TableHead>
            <TableHead className="text-right">Valor total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Nº da NF</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Aprovada em</TableHead>
            <TableHead>NF emitida em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medicoes.map((medicao) => (
            <MedicaoLinha key={medicao.id} medicao={medicao} to={`/admin/obras/${obraId}/medicoes/${medicao.id}`} />
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
