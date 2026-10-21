import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { RelatorioMensalAdmin } from '@/interfaces/relatorioMensal';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import { RelatorioStatusBadge } from './RelatorioStatusBadge';

interface RelatorioLinhaProps {
  relatorio: RelatorioMensalAdmin;
  /** Destino do detalhe/edição. */
  to: string;
  /** Excluindo este relatório: trava os botões da linha. */
  ocupado: boolean;
  onAskDelete: (relatorio: RelatorioMensalAdmin) => void;
}

const SEM_VALOR = '—';
const RESUMO_MAX = 200;

/** Primeiros caracteres do texto numa linha só (quebras viram espaço), para a coluna "Resumo". */
const resumoDe = (conteudo: string) => conteudo.slice(0, RESUMO_MAX).replace(/\s+/g, ' ').trim();

/**
 * Uma linha da lista: competência (link), resumo do texto (truncado), status, datas e ações. Altura fixa (botões de 28px)
 * com ou sem "Excluir": publicado só abre. O texto é sempre texto, nunca HTML.
 */
export const RelatorioLinha = ({ relatorio, to, ocupado, onAskDelete }: RelatorioLinhaProps) => {
  // Constants derivadas
  const titulo = formatMonthYearTitle(relatorio.competencia);
  const rascunho = relatorio.status === 'draft';
  const resumo = resumoDe(relatorio.conteudo);

  // Functions
  const handleAskDelete = () => onAskDelete(relatorio);

  // Return
  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        <Link
          to={to}
          aria-label={`Abrir relatório de ${titulo}`}
          className="text-info underline-offset-4 hover:underline"
        >
          {titulo}
        </Link>
      </TableCell>
      <TableCell className="truncate text-muted-foreground" title={resumo}>
        {resumo}
      </TableCell>
      <TableCell>
        <RelatorioStatusBadge status={relatorio.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {relatorio.publishedAt ? formatTimestamp(relatorio.publishedAt) : SEM_VALOR}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatTimestamp(relatorio.updatedAt)}</TableCell>
      <TableCell>
        <div className="flex h-7 items-center justify-end gap-2">
          <Button
            asChild
            size="icon"
            variant="outline"
            className="size-7"
            title={rascunho ? 'Editar rascunho' : 'Ver relatório publicado'}
          >
            <Link to={to} aria-label={`${rascunho ? 'Editar' : 'Ver'} relatório de ${titulo}`}>
              {rascunho ? <Pencil aria-hidden /> : <Eye aria-hidden />}
            </Link>
          </Button>
          {rascunho && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7 text-danger"
              disabled={ocupado}
              aria-label={`Excluir relatório de ${titulo}`}
              title="Excluir rascunho"
              onClick={handleAskDelete}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};
