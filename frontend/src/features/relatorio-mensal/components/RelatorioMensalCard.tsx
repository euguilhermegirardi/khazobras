import type { RelatorioMensal } from '@/shared/interfaces/relatorioMensal'
import { formatMonthYear, formatTimestamp } from '@/shared/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

interface RelatorioMensalCardProps {
  relatorio: RelatorioMensal
}

export const RelatorioMensalCard = ({ relatorio }: RelatorioMensalCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="capitalize">{formatMonthYear(relatorio.competencia)}</CardTitle>
      {relatorio.publishedAt && (
        <p className="text-xs text-muted-foreground">Publicado em {formatTimestamp(relatorio.publishedAt)}</p>
      )}
    </CardHeader>
    <CardContent>
      {/* Texto puro vindo da API: preserva quebras de linha sem interpretar HTML. */}
      <p className="whitespace-pre-line text-[13px] leading-relaxed">{relatorio.conteudo}</p>
    </CardContent>
  </Card>
)
