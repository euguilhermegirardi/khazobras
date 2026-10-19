import { CircleAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useEtapas } from '@/hooks/useEtapas';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { ApiError } from '@/services/apiClient';
import { agruparPorEtapa } from '../agrupar';
import { ProjetosEtapaCard } from '../components/ProjetosEtapaCard';
import { type ProjetoAcao, useAcaoProjeto, useProjetos } from '../hooks';

const TITULO = 'Projetos';
const DESCRICAO = 'As plantas e os documentos técnicos da sua obra, por etapa.';
const MENSAGEM_ERRO = 'Não foi possível carregar os projetos.';
const MENSAGEM_ERRO_ACAO = 'Não foi possível abrir o arquivo. Tente novamente.';
const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para acessar este arquivo.';
const MENSAGEM_VAZIO = 'Quando a Khaz Engenharia enviar uma planta ou documento técnico da sua obra, ele aparece aqui.';

export const ProjetosPage = () => {
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useProjetos(obraId);
  // Sem o nome da etapa a tela segue com títulos genéricos (por isso o erro daqui é ignorado)
  const { data: etapas, isPending: etapasPending } = useEtapas(obraId);
  const acao = useAcaoProjeto();

  // Constants derivadas
  const ocupadoId = acao.isPending ? (acao.variables?.projeto.id ?? null) : null;
  const erroAcao = acao.isError
    ? acao.error instanceof ApiError && acao.error.kind === 'forbidden'
      ? MENSAGEM_SEM_PERMISSAO
      : MENSAGEM_ERRO_ACAO
    : null;

  // Functions
  const handleRetry = () => void refetch();
  const handleAcao = (projeto: ProjetoDocumento, tipo: ProjetoAcao) => acao.mutate({ projeto, acao: tipo });

  // Retornos breves
  if (isPending || etapasPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Carregando projetos…</span>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
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
          <p className="text-[13px] font-medium text-foreground">Nenhum projeto disponível ainda</p>
          <p className="mt-1 text-[13px]">{MENSAGEM_VAZIO}</p>
        </div>
      </PageSection>
    );
  }

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        {erroAcao && (
          <Alert variant="danger">
            <CircleAlert aria-hidden />
            <AlertDescription>
              <p>{erroAcao}</p>
            </AlertDescription>
          </Alert>
        )}
        {agruparPorEtapa(data, etapas ?? []).map((grupo) => (
          <ProjetosEtapaCard
            key={grupo.key}
            titulo={grupo.titulo}
            projetos={grupo.projetos}
            ocupadoId={ocupadoId}
            onAcao={handleAcao}
          />
        ))}
      </div>
    </PageSection>
  );
};
