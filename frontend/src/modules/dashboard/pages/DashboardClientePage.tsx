import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Skeleton } from '@/components/ui/skeleton';
import { CustoAcumuladoCard } from '../components/CustoAcumuladoCard';
import { DashboardKpis } from '../components/DashboardKpis';
import { EtapasAvancoCard } from '../components/EtapasAvancoCard';
import { useDashboard } from '../hooks';

const TITULO = 'Dashboard';
const DESCRICAO = 'Um resumo do andamento da sua obra.';
const MENSAGEM_ERRO = 'Não foi possível carregar o dashboard.';

export const DashboardClientePage = () => {
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useDashboard(obraId);

  // Functions
  const handleRetry = () => void refetch();

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando dashboard…</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[74px] rounded-md" />
            ))}
          </div>
          <div className="grid gap-3.5 lg:grid-cols-5">
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-xl lg:col-span-3" />
          </div>
        </div>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    );
  }

  // Return: obra sem etapas nem medições não é erro, cada card mostra o seu estado vazio.
  return (
    <PageSection title={data.obra.nome} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        <DashboardKpis dashboard={data} />
        <div className="grid items-start gap-3.5 lg:grid-cols-5">
          <EtapasAvancoCard etapas={data.avancoPorEtapa} />
          <CustoAcumuladoCard medidoPorMes={data.medidoPorMes} />
        </div>
      </div>
    </PageSection>
  );
};
