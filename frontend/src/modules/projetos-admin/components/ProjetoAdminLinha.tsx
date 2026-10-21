import { Download, Eye, Pencil, Trash2 } from 'lucide-react';
import { ArquivoIcone } from '@/components/ArquivoIcone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ProjetoAcao } from '@/hooks/useProjetos';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { podeVisualizar } from '@/utils/arquivoTipo';
import { formatTimestamp } from '@/utils/dates';

interface ProjetoAdminLinhaProps {
  projeto: ProjetoDocumento;
  /** Visualizando, baixando ou excluindo este documento: trava os botões da linha. */
  ocupado: boolean;
  onAcao: (projeto: ProjetoDocumento, acao: ProjetoAcao) => void;
  onEdit: (projeto: ProjetoDocumento) => void;
  onAskDelete: (projeto: ProjetoDocumento) => void;
}

/**
 * Uma linha da tabela de documentos: ícone do tipo + nome (truncado, `title` com o nome inteiro), tipo (badge), data de
 * envio e as ações. Altura fixa (botões de 28px) com ou sem "Visualizar". O nome é texto, nunca HTML.
 */
export const ProjetoAdminLinha = ({ projeto, ocupado, onAcao, onEdit, onAskDelete }: ProjetoAdminLinhaProps) => {
  // Functions
  const handleVisualizar = () => onAcao(projeto, 'visualizar');
  const handleBaixar = () => onAcao(projeto, 'baixar');
  const handleEdit = () => onEdit(projeto);
  const handleAskDelete = () => onAskDelete(projeto);

  // Return
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <ArquivoIcone nome={projeto.nome} />
          <span className="truncate" title={projeto.nome}>
            {projeto.nome}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {projeto.tipoDocumento ? (
          <Badge variant="neutral" className="max-w-full" title={projeto.tipoDocumento}>
            <span className="truncate">{projeto.tipoDocumento}</span>
          </Badge>
        ) : (
          <span className="text-muted-foreground" aria-label="Sem tipo">
            —
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatTimestamp(projeto.uploadedAt)}</TableCell>
      <TableCell>
        <div className="flex h-7 items-center justify-end gap-2">
          {podeVisualizar(projeto.nome) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ocupado}
              aria-label={`Visualizar ${projeto.nome}`}
              onClick={handleVisualizar}
            >
              <Eye aria-hidden />
              Visualizar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocupado}
            aria-label={`Baixar ${projeto.nome}`}
            onClick={handleBaixar}
          >
            <Download aria-hidden />
            Baixar
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            disabled={ocupado}
            aria-label={`Editar ${projeto.nome}`}
            title="Editar nome, tipo e etapa"
            onClick={handleEdit}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7 text-danger"
            disabled={ocupado}
            aria-label={`Excluir ${projeto.nome}`}
            title="Excluir documento"
            onClick={handleAskDelete}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
