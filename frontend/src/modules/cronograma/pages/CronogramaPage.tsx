import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Skeleton } from '@/components/ui/skeleton';
import { toDateOnly } from '@/utils/dates';
import { CronogramaKpis } from '../components/CronogramaKpis';
import { CronogramaTimeline } from '../components/CronogramaTimeline';
import { MENSAGEM_VAZIO } from '../constants';
import { useCronograma } from '../hooks';
import { countByStatus } from '../timeline';

const TITULO = 'Cronograma';
const DESCRICAO = 'As etapas da sua obra e os prazos previstos.';
const MENSAGEM_ERRO = 'Não foi possível carregar o cronograma.';

export const CronogramaPage = () => {
  // Estados (hoje fixo durante a visita à tela)
  const [hoje] = useState(() => toDateOnly(new Date()));
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useCronograma(obraId);

  // Functions
  const handleRetry = () => void refetch();

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando cronograma…</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[74px] rounded-md" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
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

  if (data.length === 0) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
          <p className="text-[13px] font-medium text-foreground">{MENSAGEM_VAZIO}</p>
          <p className="mt-1 text-[13px]">Quando a Khaz Engenharia cadastrar as etapas, elas aparecem aqui.</p>
        </div>
      </PageSection>
    );
  }

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        <CronogramaKpis {...countByStatus(data)} />
        <CronogramaTimeline etapas={data} hoje={hoje} />
      </div>
    </PageSection>
  );
};
