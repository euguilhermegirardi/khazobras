import { Button } from '@/components/ui/button';

interface PaginationProps {
  /** Nome da navegação (ex.: "Paginação das obras"). */
  label: string;
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  /** Texto do total (ex.: "12 obras"). */
  totalText: string;
  /** Carregando outra página: trava os botões. */
  busy: boolean;
  onChange: (pageIndex: number) => void;
}

/** Anterior / Próxima com "Página X de Y". `pageIndex` base 0, como a API. */
export const Pagination = ({ label, pageIndex, pageSize, totalItems, totalText, busy, onChange }: PaginationProps) => {
  // Constants derivadas
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const hasPrevious = pageIndex > 0;
  const hasNext = pageIndex + 1 < totalPages;

  // Functions
  const handlePrevious = () => onChange(pageIndex - 1);
  const handleNext = () => onChange(pageIndex + 1);

  // Return
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-3.5 text-xs">
      <span className="text-muted-foreground">{totalText}</span>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={!hasPrevious || busy} onClick={handlePrevious}>
          Anterior
        </Button>
        <span className="text-muted-foreground">
          Página {pageIndex + 1} de {totalPages}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={!hasNext || busy} onClick={handleNext}>
          Próxima
        </Button>
      </div>
    </nav>
  );
};
