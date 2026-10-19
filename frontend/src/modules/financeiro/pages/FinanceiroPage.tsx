import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/ErrorState'
import { PageSection } from '@/components/PageSection'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { LancamentoAnexo } from '@/interfaces/financeiro'
import { ApiError } from '@/services/apiClient'
import { LancamentoLinha } from '../components/LancamentoLinha'
import { LancamentosPaginacao } from '../components/LancamentosPaginacao'
import { useDownloadComprovante, useLancamentos } from '../hooks'

const TITULO = 'Financeiro'
const DESCRICAO = 'Os lançamentos da sua obra liberados pela Khaz Engenharia, com os comprovantes.'
const MENSAGEM_ERRO = 'Não foi possível carregar os lançamentos.'
const MENSAGEM_ERRO_DOWNLOAD = 'Não foi possível baixar o comprovante. Tente novamente.'
const MENSAGEM_VAZIO = 'Quando a Khaz Engenharia liberar um lançamento da sua obra, ele aparece aqui.'

export const FinanceiroPage = () => {
  // Estados
  const [pageIndex, setPageIndex] = useState(0)
  // Hooks
  const { obraId = '' } = useParams()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useLancamentos(obraId, pageIndex)
  const download = useDownloadComprovante()

  // Constants derivadas
  const baixandoId = download.isPending ? (download.variables?.id ?? null) : null
  const erroDownload = download.isError
    ? download.error instanceof ApiError && download.error.kind === 'forbidden'
      ? 'Você não tem permissão para baixar este comprovante.'
      : MENSAGEM_ERRO_DOWNLOAD
    : null

  // Functions
  const handleRetry = () => void refetch()
  const handleDownload = (anexo: LancamentoAnexo) => download.mutate(anexo)

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Carregando lançamentos…</span>
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-64 rounded-xl" />
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

  if (data.totalItems === 0) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
          <p className="text-[13px] font-medium text-foreground">Nenhum lançamento liberado ainda</p>
          <p className="mt-1 text-[13px]">{MENSAGEM_VAZIO}</p>
        </div>
      </PageSection>
    )
  }

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        {erroDownload && (
          <Alert variant="danger">
            <CircleAlert aria-hidden />
            <AlertDescription>
              <p>{erroDownload}</p>
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((lancamento) => (
                  <LancamentoLinha
                    key={lancamento.id}
                    lancamento={lancamento}
                    baixandoId={baixandoId}
                    onDownload={handleDownload}
                  />
                ))}
              </TableBody>
            </Table>
            <LancamentosPaginacao
              pageIndex={data.pageIndex}
              pageSize={data.pageSize}
              totalItems={data.totalItems}
              ocupado={isPlaceholderData}
              onChange={setPageIndex}
            />
          </CardContent>
        </Card>
      </div>
    </PageSection>
  )
}
