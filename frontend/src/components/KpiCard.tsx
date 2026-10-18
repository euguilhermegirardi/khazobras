import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface KpiCardProps {
  label: string
  value: ReactNode
  /** Linha pequena abaixo do valor (ex.: "131,6% do contrato"). */
  hint?: ReactNode
  /** Cor do valor, pelo significado (protótipo: .kpi.blue/.green/.amber/.red/.gray). */
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
}

const TONE_CLASS = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted-foreground',
} as const

/** Card de indicador (protótipo: .kpi). Usar dentro de `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`. */
export const KpiCard = ({ label, value, hint, tone = 'neutral' }: KpiCardProps) => (
  <div className="rounded-md bg-muted px-4 py-3">
    <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
    <p className={cn('text-[22px] leading-none font-semibold', TONE_CLASS[tone])}>{value}</p>
    {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
)
