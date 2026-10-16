import { Clock } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/shared/components/ErrorState'
import { PageSection } from '@/shared/components/PageSection'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { MedicaoLinhaResumo } from '../components/MedicaoLinhaResumo'
import { useMedicoes } from '../hooks'

interface FechamentoPageProps {
  /** Monta o destino dos itens de uma medição (cada visão tem o seu prefixo). */
  medicaoPath: (obraId: string, medicaoId: string) => string
}

const TITULO = 'Fechamento'
const DESCRICAO = 'Confira as medições da obra e aprove o que foi executado.'
const MENSAGEM_ERRO = 'Não foi possível carregar as medições.'
const MENSAGEM_VAZIO = 'Nenhuma medição foi enviada ainda. Quando a Khaz Engenharia enviar uma, ela aparece aqui.'

export const FechamentoPage = ({ medicaoPath }: FechamentoPageProps) => {
  // Hooks
  const { obraId = '' } = useParams()
  const { data, isPending, isError, error, refetch } = useMedicoes(obraId)

  // Constants derivadas
  const medicoes = [...(data ?? [])].sort((a, b) => b.numero - a.numero)
  const aguardando = medicoes.filter((m) => m.status === 'PendingApproval').length

  // Functions
  const handleRetry = () => void refetch()

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Carregando medições…</span>
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </PageSection>
    )
  }

  if (isError) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    )
  }

  if (medicoes.length === 0) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          {MENSAGEM_VAZIO}
        </p>
      </PageSection>
    )
  }

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        {aguardando > 0 && (
          <Alert variant="warning">
            <Clock aria-hidden />
            <AlertDescription>
              <p>
                {aguardando === 1
                  ? 'Você tem 1 medição aguardando sua aprovação.'
                  : `Você tem ${aguardando} medições aguardando sua aprovação.`}
              </p>
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Medição</TableHead>
                  <TableHead className="hidden sm:table-cell">Mês de referência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicoes.map((medicao) => (
                  <MedicaoLinhaResumo key={medicao.id} medicao={medicao} to={medicaoPath(obraId, medicao.id)} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageSection>
  )
}
