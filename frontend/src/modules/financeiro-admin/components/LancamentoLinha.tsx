import { Paperclip, Pencil, Trash2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { formatDateOnly, formatMonthYearTitle } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { CATEGORIA_LABEL } from '@/utils/lancamentoCategoria';
import { VisibilidadeToggle } from './VisibilidadeToggle';

interface LancamentoLinhaProps {
  lancamento: LancamentoAdmin;
  selecionado: boolean;
  /** Id do lançamento que está gravando a visibilidade (null = nenhum). */
  gravandoId: string | null;
  onSelect: (id: string, marcado: boolean) => void;
  onVisibilidade: (lancamento: LancamentoAdmin, visivelCliente: boolean) => void;
  onEdit: (lancamento: LancamentoAdmin) => void;
  onDelete: (lancamento: LancamentoAdmin) => void;
}

/** Linha da tabela. Toda célula é de uma linha só (texto livre trunca com `title`), para a altura ser a mesma. */
export const LancamentoLinha = ({
  lancamento,
  selecionado,
  gravandoId,
  onSelect,
  onVisibilidade,
  onEdit,
  onDelete,
}: LancamentoLinhaProps) => {
  // Constants derivadas
  const competencia = formatMonthYearTitle(lancamento.mesCompetencia);
  const categoria = CATEGORIA_LABEL[lancamento.categoria] ?? lancamento.categoria;
  const valor = formatCurrency(lancamento.valor);
  const totalAnexos = lancamento.anexos.length;

  // Functions
  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => onSelect(lancamento.id, e.target.checked);
  const handleVisibilidade = (visivelCliente: boolean) => onVisibilidade(lancamento, visivelCliente);
  const handleEdit = () => onEdit(lancamento);
  const handleDelete = () => onDelete(lancamento);

  // Return
  return (
    <TableRow data-state={selecionado ? 'selected' : undefined}>
      <TableCell>
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={selecionado}
          onChange={handleSelect}
          aria-label={`Selecionar lançamento: ${lancamento.descricao}`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatDateOnly(lancamento.dataLancamento)}</TableCell>
      <TableCell className="truncate text-muted-foreground" title={competencia}>
        {competencia}
      </TableCell>
      <TableCell>
        <Badge variant="neutral">{categoria}</Badge>
      </TableCell>
      <TableCell className="truncate font-medium" title={lancamento.descricao}>
        {lancamento.descricao}
      </TableCell>
      <TableCell className="truncate text-right tabular-nums" title={valor}>
        {valor}
      </TableCell>
      <TableCell>
        <div className="flex h-7 items-center text-muted-foreground">
          {totalAnexos === 0 ? (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">Sem anexos</span>
            </>
          ) : (
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              title={lancamento.anexos.map((a) => a.nomeArquivo).join(', ')}
            >
              <Paperclip className="size-3.5" aria-hidden />
              <span aria-hidden>{totalAnexos}</span>
              <span className="sr-only">{totalAnexos === 1 ? '1 anexo' : `${totalAnexos} anexos`}</span>
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <VisibilidadeToggle
          descricao={lancamento.descricao}
          liberado={lancamento.visivelCliente}
          gravando={gravandoId === lancamento.id}
          travado={gravandoId !== null}
          onChange={handleVisibilidade}
        />
      </TableCell>
      <TableCell>
        <div className="flex h-7 items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Editar lançamento: ${lancamento.descricao}`}
            title="Editar"
            onClick={handleEdit}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-danger hover:text-danger"
            aria-label={`Excluir lançamento: ${lancamento.descricao}`}
            title="Excluir"
            onClick={handleDelete}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
