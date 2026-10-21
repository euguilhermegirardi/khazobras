import type { RelatorioMensal } from '@/interfaces/relatorioMensal';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatorioMensalCardProps {
  relatorio: Pick<RelatorioMensal, 'competencia' | 'conteudo' | 'publishedAt'>;
  /** Classes do corpo (ex.: altura máxima com rolagem na pré-visualização). */
  contentClassName?: string;
}

/**
 * O relatório como o cliente o vê: competência, data de publicação e texto. Usado na tela do cliente e na
 * pré-visualização do admin ("Como o cliente vê").
 */
export const RelatorioMensalCard = ({ relatorio, contentClassName }: RelatorioMensalCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{formatMonthYearTitle(relatorio.competencia)}</CardTitle>
      {relatorio.publishedAt && (
        <p className="text-xs text-muted-foreground">Publicado em {formatTimestamp(relatorio.publishedAt)}</p>
      )}
    </CardHeader>
    <CardContent className={contentClassName}>
      {/* Texto puro vindo da API: preserva quebras e espaços sem interpretar HTML; linha longa sem espaço quebra. */}
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{relatorio.conteudo}</p>
    </CardContent>
  </Card>
);
