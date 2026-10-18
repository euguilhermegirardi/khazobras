import { ErrorState } from '@/components/ErrorState'
import { PageSection } from '@/components/PageSection'
import { Skeleton } from '@/components/ui/skeleton'
import { ObraCard } from '../components/ObraCard'
import { useObras } from '../hooks'

interface ObraHubPageProps {
  /** Monta o destino da obra escolhida (cada visão tem o seu prefixo). */
  obraPath: (obraId: string) => string
}

// Constants (não dependem de props/estado: ficam fora do componente)
const TITULO = 'Suas obras'
const MENSAGEM_ERRO = 'Não foi possível carregar as obras.'
const MENSAGEM_VAZIO = 'Nenhuma obra vinculada à sua conta ainda. Fale com a Khaz Engenharia.'

export const ObraHubPage = ({ obraPath }: ObraHubPageProps) => {
  // Hooks
  const { data, isPending, isError, error, refetch } = useObras()

  // Functions
  const handleRetry = () => void refetch()

  // Retornos breves (carregando / erro / vazio) — sempre depois de todos os hooks
  if (isPending) {
    return (
      <PageSection title={TITULO}>
        <div role="status" className="grid gap-4 md:grid-cols-2">
          <span className="sr-only">Carregando obras…</span>
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </PageSection>
    )
  }

  if (isError) {
    return (
      <PageSection title={TITULO}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    )
  }

  if (data.items.length === 0) {
    return (
      <PageSection title={TITULO}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          {MENSAGEM_VAZIO}
        </p>
      </PageSection>
    )
  }

  // Return
  return (
    <PageSection title={TITULO}>
      <ul className="grid gap-4 md:grid-cols-2">
        {data.items.map((obra) => (
          <ObraCard key={obra.id} obra={obra} to={obraPath(obra.id)} />
        ))}
      </ul>
    </PageSection>
  )
}
