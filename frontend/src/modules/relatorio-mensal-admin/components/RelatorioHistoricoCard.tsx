import { History } from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils/dates';
import { useHistoricoRelatorio } from '../hooks';
import { acaoLegivel, autorLegivel, camposLegiveis } from '../relatorioLista';

interface RelatorioHistoricoCardProps {
  obraId: string;
  relatorioId: string;
}

const MENSAGEM_ERRO = 'Não foi possível carregar o histórico.';

/**
 * Painel "Histórico de alterações": quem criou, editou e publicou, e quando; na edição, quais campos mudaram (nunca o
 * texto anterior). É uma query secundária: carrega e falha sozinha, sem derrubar o relatório.
 */
export const RelatorioHistoricoCard = ({ obraId, relatorioId }: RelatorioHistoricoCardProps) => {
  // Hooks
  const { data, isLoading, isError, error, refetch } = useHistoricoRelatorio(obraId, relatorioId);

  // Functions
  const handleRetry = () => void refetch();

  // Return
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <History aria-hidden />
          <h2>Histórico de alterações</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">Carregando histórico…</span>
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        ) : isError ? (
          <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
        ) : !data || data.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <ul aria-label="Alterações do relatório" className="flex max-h-[28rem] flex-col overflow-y-auto">
            {data.map((item, indice) => {
              const campos = camposLegiveis(item.campos);
              const autor = autorLegivel(item);
              return (
                <li
                  key={`${item.createdAt}-${item.acao}-${indice}`}
                  className="flex min-w-0 items-baseline gap-3 border-b py-2 text-[13px] last:border-0"
                >
                  <span className="w-36 shrink-0 text-muted-foreground tabular-nums">
                    {formatDateTime(item.createdAt)}
                  </span>
                  <span className="w-40 shrink-0 font-medium">{acaoLegivel(item.acao)}</span>
                  <span className="min-w-0 truncate" title={autor}>
                    por {autor}
                  </span>
                  {campos && <span className="shrink-0 text-muted-foreground">· alterou: {campos}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
