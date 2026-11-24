import type { RelatorioMensal } from '@/interfaces/relatorioMensal';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import { MarkdownTexto } from '@/components/MarkdownTexto';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatorioMensalCardProps {
  relatorio: Pick<RelatorioMensal, 'competencia' | 'conteudo' | 'publishedAt'>;
  /** Classes do corpo (ex.: altura máxima com rolagem na pré-visualização). */
  contentClassName?: string;
}

/**
 * O relatório como o cliente o vê: competência, data de publicação e texto. Usado na tela do cliente e na
 * pré-visualização do admin ("Como o cliente vê"). O texto é Markdown simples, renderizado sem HTML cru nem links.
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
      {/* Markdown simples (ou texto puro antigo): nunca vira HTML do usuário; ver `MarkdownTexto`. */}
      <MarkdownTexto conteudo={relatorio.conteudo} />
    </CardContent>
  </Card>
);
