import { Link } from 'react-router-dom'
import type { Obra } from '@/shared/interfaces/obra'
import { formatDateOnly } from '@/shared/lib/dates'
import { formatCurrency } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { OBRA_STATUS_LABEL } from '../constants'

interface ObraCardProps {
  obra: Obra
  to: string
}

export const ObraCard = ({ obra, to }: ObraCardProps) => {
  const dataInicio = obra.dataInicio ? formatDateOnly(obra.dataInicio) : '—'
  const dataPrevisaoTermino = obra.dataPrevisaoTermino ? formatDateOnly(obra.dataPrevisaoTermino) : '—'

  return (
    <li>
      <Link to={to} className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
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
                <dd className="font-medium">{dataInicio}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Previsão de término</dt>
                <dd className="font-medium">{dataPrevisaoTermino}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}
