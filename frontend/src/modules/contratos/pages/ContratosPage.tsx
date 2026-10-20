import { useParams } from 'react-router-dom';
import { ContratosKpis } from '@/components/ContratosKpis';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Skeleton } from '@/components/ui/skeleton';
import { ContratoClienteCard } from '../components/ContratoClienteCard';
import { useContratos } from '../hooks';

const TITULO = 'Contratos';
const DESCRICAO = 'Os contratos da sua obra e os pagamentos já feitos.';
const MENSAGEM_ERRO = 'Não foi possível carregar os contratos.';

export const ContratosPage = () => {
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useContratos(obraId);

  // Functions
  const handleRetry = () => void refetch();

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando contratos…</span>
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-64 rounded-xl" />
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
          <p className="text-[13px] font-medium text-foreground">Nenhum contrato registrado para esta obra</p>
          <p className="mt-1 text-[13px]">Quando a Khaz Engenharia registrar o contrato, ele aparece aqui.</p>
        </div>
      </PageSection>
    );
  }

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        <ContratosKpis contratos={data} />
        {data.map((contrato) => (
          <ContratoClienteCard key={contrato.id} obraId={obraId} contrato={contrato} />
        ))}
      </div>
    </PageSection>
  );
};
