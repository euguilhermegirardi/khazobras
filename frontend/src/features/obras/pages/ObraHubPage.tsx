import { Link } from 'react-router-dom'
import { ApiError } from '@/shared/lib/apiClient'
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
    <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-900">
      <p>{apiError?.message ?? 'Não foi possível carregar as obras.'}</p>
      {apiError?.requestId && <p className="mt-1 text-sm">Código para o suporte: {apiError.requestId}</p>}
      <button type="button" onClick={onRetry} className="mt-3 rounded border border-red-300 px-3 py-1 hover:bg-red-100">
        Tentar novamente
      </button>
    </div>
  )
}

function ObraCard({ obra, to }: { obra: Obra; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{obra.nome}</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {OBRA_STATUS_LABEL[obra.status]}
          </span>
        </div>
        {obra.endereco && <p className="mt-1 text-sm text-slate-600">{obra.endereco}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Valor contratado</dt>
            <dd className="font-medium">{formatCurrency(obra.valorContratado)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Início</dt>
            <dd className="font-medium">{obra.dataInicio ? formatDateOnly(obra.dataInicio) : '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Previsão de término</dt>
            <dd className="font-medium">{obra.dataPrevisaoTermino ? formatDateOnly(obra.dataPrevisaoTermino) : '—'}</dd>
          </div>
        </dl>
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
          <p role="status" className="text-slate-600">
            Carregando obras…
          </p>
        )}
        {isError && <ErrorMessage error={error} onRetry={() => void refetch()} />}
        {data && data.items.length === 0 && (
          <p className="rounded border border-dashed border-slate-300 p-6 text-slate-600">
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
