import { Button } from '@/components/ui/button';

interface LancamentosPaginacaoProps {
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  /** Carregando outra página: trava os botões. */
  ocupado: boolean;
  onChange: (pageIndex: number) => void;
}

export const LancamentosPaginacao = ({
  pageIndex,
  pageSize,
  totalItems,
  ocupado,
  onChange,
}: LancamentosPaginacaoProps) => {
  // Constants derivadas
  const totalPaginas = Math.max(1, Math.ceil(totalItems / pageSize));
  const temAnterior = pageIndex > 0;
  const temProxima = pageIndex + 1 < totalPaginas;

  // Functions
  const handleAnterior = () => onChange(pageIndex - 1);
  const handleProxima = () => onChange(pageIndex + 1);

  // Return
  return (
    <nav aria-label="Paginação dos lançamentos" className="flex items-center justify-between gap-3 pt-3.5 text-xs">
      <span className="text-muted-foreground">{totalItems === 1 ? '1 lançamento' : `${totalItems} lançamentos`}</span>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={!temAnterior || ocupado} onClick={handleAnterior}>
          Anterior
        </Button>
        <span className="text-muted-foreground">
          Página {pageIndex + 1} de {totalPaginas}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={!temProxima || ocupado} onClick={handleProxima}>
          Próxima
        </Button>
      </div>
    </nav>
  );
};
