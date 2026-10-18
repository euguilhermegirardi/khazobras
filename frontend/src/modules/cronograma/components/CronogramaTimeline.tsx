import { CalendarRange } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EtapaCronograma } from '@/interfaces/etapa'
import { formatDateOnly, formatMonthYearShort, monthIndexToDateOnly } from '@/utils/dates'
import { MONTH_WIDTH } from '../constants'
import { buildRange, todayLeft } from '../timeline'
import { CronogramaLegenda } from './CronogramaLegenda'
import { EtapaLinha } from './EtapaLinha'

interface CronogramaTimelineProps {
  etapas: EtapaCronograma[]
  /** Hoje, "yyyy-MM-dd" (data local). */
  hoje: string
}

export const CronogramaTimeline = ({ etapas, hoje }: CronogramaTimelineProps) => {
  // Constants derivadas
  const range = buildRange(etapas, hoje)
  const hojeLeft = todayLeft(hoje, range)
  const meses = Array.from({ length: range.months }, (_, i) => monthIndexToDateOnly(range.firstMonth + i))
  const intervalo = `${formatMonthYearShort(meses[0] ?? hoje)} – ${formatMonthYearShort(meses[meses.length - 1] ?? hoje)}`

  // Return
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <CalendarRange aria-hidden />
          Cronograma físico — linha do tempo
        </CardTitle>
        <CardAction className="text-xs text-muted-foreground">
          {intervalo}
          {hojeLeft !== null && ` · Hoje: ${formatDateOnly(hoje)}`}
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" role="region" aria-label="Linha do tempo das etapas">
          <div className="min-w-max">
            <div className="flex border-b">
              <div className="sticky left-0 z-10 flex w-96 shrink-0 items-center bg-card text-[11px] text-muted-foreground">
                <span className="w-64">Etapa</span>
                <span className="w-32">Situação</span>
              </div>
              {meses.map((mes) => (
                <div
                  key={mes}
                  className="flex h-8 shrink-0 items-center border-l px-1.5 text-[11px] text-muted-foreground"
                  style={{ width: MONTH_WIDTH }}
                >
                  {formatMonthYearShort(mes)}
                </div>
              ))}
            </div>
            <ul>
              {etapas.map((etapa) => (
                <EtapaLinha key={etapa.id} etapa={etapa} range={range} hojeLeft={hojeLeft} />
              ))}
            </ul>
          </div>
        </div>
        <CronogramaLegenda comHoje={hojeLeft !== null} />
      </CardContent>
    </Card>
  )
}
