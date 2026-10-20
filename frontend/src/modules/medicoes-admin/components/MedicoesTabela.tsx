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
      <Table className="table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
        {/*
          Larguras fixas (padding de 6px por lado) somam 880px; a Etapa (sem largura) leva o resto e trunca.
          Em 1280: 1280 - 210 (sidebar) - 40 (main) - 32 (card) = 998px, logo Etapa >= ~118px (~103px com barra de rolagem).
          Competência 128 (maior texto ~105px), NF 112 ("NF-2026-0187" ~100px; o resto trunca com title).
        */}
        <colgroup>
          <col className="w-10" />
          <col className="w-32" />
          <col />
          <col className="w-10" />
          <col className="w-26" />
          <col className="w-50" />
          <col className="w-28" />
          <col className="w-21" />
          <col className="w-21" />
          <col className="w-22" />
        </colgroup>
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
