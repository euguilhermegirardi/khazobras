import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Skeleton } from '@/components/ui/skeleton';
import { RelatorioMensalCard } from '../components/RelatorioMensalCard';
import { useRelatoriosMensais } from '../hooks';

const TITULO = 'Relatório mensal';
const DESCRICAO = 'O resumo de cada mês da sua obra, publicado pela Khaz Engenharia.';
const MENSAGEM_ERRO = 'Não foi possível carregar os relatórios.';
const MENSAGEM_VAZIO = 'Nenhum relatório foi publicado ainda. Quando a Khaz Engenharia publicar um, ele aparece aqui.';

export const RelatorioMensalPage = () => {
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useRelatoriosMensais(obraId);

  // Constants derivadas (mês mais novo primeiro; "yyyy-MM-dd" ordena como texto)
  const relatorios = [...(data ?? [])].sort((a, b) => b.competencia.localeCompare(a.competencia));

  // Functions
  const handleRetry = () => void refetch();

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Carregando relatórios…</span>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
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

  if (relatorios.length === 0) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          {MENSAGEM_VAZIO}
        </p>
      </PageSection>
    );
  }

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        {relatorios.map((relatorio) => (
          <RelatorioMensalCard key={relatorio.id} relatorio={relatorio} />
        ))}
      </div>
    </PageSection>
  );
};
