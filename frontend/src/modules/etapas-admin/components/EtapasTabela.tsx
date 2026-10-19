import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { EtapaGanttLinha } from './EtapaGanttLinha';

interface EtapasTabelaProps {
  etapas: EtapaCronograma[];
  onEdit: (etapa: EtapaCronograma) => void;
}

/** Tabela das etapas da obra, na ordem do backend (`ordem`). */
export const EtapasTabela = ({ etapas, onEdit }: EtapasTabelaProps) => (
  <Card>
    <CardContent>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Previsto</TableHead>
            <TableHead>Real</TableHead>
            <TableHead>% exec.</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Peso</TableHead>
            <TableHead>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {etapas.map((etapa) => (
            <EtapaGanttLinha key={etapa.id} etapa={etapa} onEdit={onEdit} />
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
