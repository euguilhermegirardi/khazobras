import type { RelatorioMensal } from '@/interfaces/relatorioMensal';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatorioMensalCardProps {
  relatorio: RelatorioMensal;
}

export const RelatorioMensalCard = ({ relatorio }: RelatorioMensalCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{formatMonthYearTitle(relatorio.competencia)}</CardTitle>
      {relatorio.publishedAt && (
        <p className="text-xs text-muted-foreground">Publicado em {formatTimestamp(relatorio.publishedAt)}</p>
      )}
    </CardHeader>
    <CardContent>
      {/* Texto puro vindo da API: preserva quebras de linha sem interpretar HTML. */}
      <p className="whitespace-pre-line text-[13px] leading-relaxed">{relatorio.conteudo}</p>
    </CardContent>
  </Card>
);
