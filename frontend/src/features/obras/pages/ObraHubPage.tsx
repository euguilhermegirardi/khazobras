import { Link } from 'react-router-dom'
import { ApiError } from '@/shared/lib/apiClient'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { formatCurrency } from '@/shared/lib/format'
import { formatDateOnly } from '@/shared/lib/dates'
import { useObras } from '../hooks'
import { OBRA_STATUS_LABEL, type Obra } from '../types'

interface Props {
  /** Monta o destino da obra escolhida (cada visao tem o seu prefixo). */
  obraPath: (obraId: string) => string
}

function ErrorMessage({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p>{apiError?.message ?? 'Não foi possível carregar as obras.'}</p>
      {apiError?.requestId && (
        <p className="mt-1 text-sm text-muted-foreground">Código para o suporte: {apiError.requestId}</p>
      )}
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}

function ObraCard({ obra, to }: { obra: Obra; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Card className="transition-colors hover:border-ring">
          <CardHeader>
            <CardTitle>
              <h2 className="text-lg font-semibold">{obra.nome}</h2>
            </CardTitle>
            {obra.endereco && <CardDescription>{obra.endereco}</CardDescription>}
            <CardAction>
              <Badge variant="secondary">{OBRA_STATUS_LABEL[obra.status]}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Valor contratado</dt>
                <dd className="font-medium">{formatCurrency(obra.valorContratado)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Início</dt>
                <dd className="font-medium">{obra.dataInicio ? formatDateOnly(obra.dataInicio) : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Previsão de término</dt>
                <dd className="font-medium">
                  {obra.dataPrevisaoTermino ? formatDateOnly(obra.dataPrevisaoTermino) : '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}

export function ObraHubPage({ obraPath }: Props) {
  const { data, isPending, isError, error, refetch } = useObras()

  return (
    <section aria-labelledby="hub-title">
      <h1 id="hub-title" className="text-xl font-semibold">
        Suas obras
      </h1>
      <div className="mt-4">
        {isPending && (
          <p role="status" className="text-muted-foreground">
            Carregando obras…
          </p>
        )}
        {isError && <ErrorMessage error={error} onRetry={() => void refetch()} />}
        {data && data.items.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-muted-foreground">
            Nenhuma obra vinculada à sua conta ainda. Fale com a Khaz Engenharia.
          </p>
        )}
        {data && data.items.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {data.items.map((obra) => (
              <ObraCard key={obra.id} obra={obra} to={obraPath(obra.id)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
