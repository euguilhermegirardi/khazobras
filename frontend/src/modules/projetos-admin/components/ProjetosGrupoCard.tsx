import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProjetoAcao } from '@/hooks/useProjetos';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { plural } from '@/utils/uploadFila';
import { ProjetoAdminLinha } from './ProjetoAdminLinha';

interface ProjetosGrupoCardProps {
  /** Nome da etapa, "Sem etapa" ou "Etapa não identificada". */
  titulo: string;
  projetos: ProjetoDocumento[];
  /** Id do documento em visualização/download/exclusão (null = nenhum). */
  ocupadoId: string | null;
  onAcao: (projeto: ProjetoDocumento, acao: ProjetoAcao) => void;
  onEdit: (projeto: ProjetoDocumento) => void;
  onAskDelete: (projeto: ProjetoDocumento) => void;
}

/**
 * Um `Card` por etapa com a tabela dos documentos dela. Colunas fixas (`table-fixed`), iguais em todos os cards
 * empilhados: Tipo 160, Enviado em 100, Ações 272 (4 botões); o Nome ocupa o resto (≈466px de 998 no 1280) e trunca.
 */
export const ProjetosGrupoCard = ({
  titulo,
  projetos,
  ocupadoId,
  onAcao,
  onEdit,
  onAskDelete,
}: ProjetosGrupoCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="min-w-0 justify-between gap-3">
        <h2 className="truncate" title={titulo}>
          {titulo}
        </h2>
        <span className="shrink-0 text-[11px] font-normal">{plural(projetos.length, 'documento', 'documentos')}</span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Table className="table-fixed">
        <colgroup>
          <col />
          <col className="w-40" />
          <col className="w-[100px]" />
          <col className="w-[272px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Enviado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projetos.map((projeto) => (
            <ProjetoAdminLinha
              key={projeto.id}
              projeto={projeto}
              ocupado={ocupadoId === projeto.id}
              onAcao={onAcao}
              onEdit={onEdit}
              onAskDelete={onAskDelete}
            />
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
