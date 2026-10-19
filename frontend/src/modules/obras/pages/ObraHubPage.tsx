import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Pagination } from '@/components/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ObraCard } from '../components/ObraCard';
import { useObras } from '../hooks';

interface ObraHubPageProps {
  /** Monta o destino da obra escolhida (cada visão tem o seu prefixo). */
  obraPath: (obraId: string) => string;
  /** Título da tela (cliente: "Suas obras"; admin: "Meus projetos"). */
  title: string;
  /** Subtítulo cinza abaixo do título. */
  description?: string;
  /** Mensagem quando não há nenhuma obra para mostrar. */
  emptyMessage: string;
}

// Constants (não dependem de props/estado: ficam fora do componente)
const PAGE_SIZE = 50;
const MENSAGEM_ERRO = 'Não foi possível carregar as obras.';

export const ObraHubPage = ({ obraPath, title, description, emptyMessage }: ObraHubPageProps) => {
  // Estados
  const [pageIndex, setPageIndex] = useState(0);
  // Hooks
  const { data, isPending, isError, error, isPlaceholderData, refetch } = useObras(pageIndex, PAGE_SIZE);

  // Functions
  const handleRetry = () => void refetch();

  // Retornos breves (carregando / erro / vazio) — sempre depois de todos os hooks
  if (isPending) {
    return (
      <PageSection title={title} description={description}>
        <div role="status" className="grid gap-4 md:grid-cols-2">
          <span className="sr-only">Carregando obras…</span>
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection title={title} description={description}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    );
  }

  if (data.items.length === 0) {
    return (
      <PageSection title={title} description={description}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          {emptyMessage}
        </p>
      </PageSection>
    );
  }

  // Return
  return (
    <PageSection title={title} description={description}>
      <ul className="grid gap-4 md:grid-cols-2">
        {data.items.map((obra) => (
          <ObraCard key={obra.id} obra={obra} to={obraPath(obra.id)} />
        ))}
      </ul>
      {data.totalItems > data.pageSize && (
        <Pagination
          label="Paginação das obras"
          pageIndex={data.pageIndex}
          pageSize={data.pageSize}
          totalItems={data.totalItems}
          totalText={`${data.totalItems} obras`}
          busy={isPlaceholderData}
          onChange={setPageIndex}
        />
      )}
    </PageSection>
  );
};
