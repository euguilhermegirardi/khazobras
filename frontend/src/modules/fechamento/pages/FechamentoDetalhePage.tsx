import { CircleCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState } from '@/components/ErrorState'
import { KpiCard } from '@/components/KpiCard'
import { PageSection } from '@/components/PageSection'
import { formatMonthYear, formatTimestamp } from '@/utils/dates'
import { formatCurrency } from '@/utils/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AprovarMedicaoPanel } from '../components/AprovarMedicaoPanel'
import { MedicaoItensTable } from '../components/MedicaoItensTable'
import { MedicaoStatusBadge } from '../components/MedicaoStatusBadge'
import { useMedicao } from '../hooks'

interface FechamentoDetalhePageProps {
  /** Destino da lista de medições da obra. */
  listaPath: (obraId: string) => string
}

const MENSAGEM_ERRO = 'Não foi possível carregar a medição.'
const MENSAGEM_OUTRA_OBRA = 'Medição não encontrada nesta obra.'

export const FechamentoDetalhePage = ({ listaPath }: FechamentoDetalhePageProps) => {
  // Hooks
  const { obraId = '', medicaoId = '' } = useParams()
  const { data, isPending, isError, error, refetch } = useMedicao(obraId, medicaoId)

  // Functions
  const handleRetry = () => void refetch()

  // Retornos breves
  const voltar = (
    <Link to={listaPath(obraId)} className="text-[13px] text-info underline-offset-4 hover:underline">
      ← Voltar para as medições
    </Link>
  )

  if (isPending) {
    return (
      <PageSection title="Medição" actions={voltar}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando medição…</span>
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </PageSection>
    )
  }

  if (isError) {
    return (
      <PageSection title="Medição" actions={voltar}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    )
  }

  // Uma medição de outra obra aberta por URL adulterada não é exibida (o backend já barra o que não é do cliente).
  if (data.obraId !== obraId) {
    return (
      <PageSection title="Medição" actions={voltar}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          {MENSAGEM_OUTRA_OBRA}
        </p>
      </PageSection>
    )
  }

  // Return
  return (
    <PageSection
      title={`Medição ${data.numero}`}
      description={`Mês de referência: ${formatMonthYear(data.competencia)}`}
      actions={voltar}
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Valor desta medição" value={formatCurrency(data.valorTotal)} tone="success" />
          <KpiCard label="Itens" value={data.itens.length} tone="warning" />
          <KpiCard label="Situação" value={<MedicaoStatusBadge status={data.status} />} />
        </div>

        {data.status === 'PendingApproval' && <AprovarMedicaoPanel medicao={data} />}

        {data.status !== 'PendingApproval' && (
          <Alert variant="success">
            <CircleCheck aria-hidden />
            <AlertDescription>
              <p>
                {data.approvedAt ? `Medição aprovada em ${formatTimestamp(data.approvedAt)}. ` : 'Medição aprovada. '}
                {data.status === 'InvoiceIssued' && data.nfNumber
                  ? `Nota fiscal nº ${data.nfNumber}${data.nfIssuedAt ? `, emitida em ${formatTimestamp(data.nfIssuedAt)}` : ''}.`
                  : 'A Khaz Engenharia vai emitir a nota fiscal.'}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Itens da medição</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicaoItensTable itens={data.itens} valorTotal={data.valorTotal} />
          </CardContent>
        </Card>
      </div>
    </PageSection>
  )
}
