import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEtapas } from '@/hooks/useEtapas';
import { RelatorioFotograficoLista } from '../components/RelatorioFotograficoLista';
import { TABS } from '../constants';
import { useRelatoriosFotograficos } from '../hooks';

const TITULO = 'Relatório fotográfico';
const DESCRICAO = 'O registro visual da sua obra, por mês e por etapa.';
const MENSAGEM_ERRO = 'Não foi possível carregar os relatórios fotográficos.';

export const RelatorioFotograficoPage = () => {
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useRelatoriosFotograficos(obraId);
  // Sem o nome da etapa a tela segue com o título do relatório (por isso o erro daqui é ignorado)
  const { data: etapas } = useEtapas(obraId);

  // Functions
  const handleRetry = () => void refetch();

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Carregando relatórios fotográficos…</span>
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-56 rounded-xl" />
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

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <Tabs defaultValue="mensal">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <RelatorioFotograficoLista tipo={tab.value} relatorios={data} etapas={etapas ?? []} />
          </TabsContent>
        ))}
      </Tabs>
    </PageSection>
  );
};
