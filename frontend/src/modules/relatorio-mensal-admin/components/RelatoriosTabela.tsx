import type { RelatorioMensalAdmin } from '@/interfaces/relatorioMensal';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RelatorioLinha } from './RelatorioLinha';

interface RelatoriosTabelaProps {
  relatorios: RelatorioMensalAdmin[];
  detalhePath: (relatorioId: string) => string;
  /** Id do relatório sendo excluído (trava os botões dele). */
  excluindoId: string | null;
  onAskDelete: (relatorio: RelatorioMensalAdmin) => void;
}

/** Histórico por competência (protótipo: docs/design/capturas/relatorio-cliente.png, tabela dentro de um Card). */
export const RelatoriosTabela = ({ relatorios, detalhePath, excluindoId, onAskDelete }: RelatoriosTabelaProps) => (
  <Card>
    <CardContent>
      <Table className="table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
        {/*
          Fixas (padding de 6px por lado) somam 512px; o Resumo (sem largura) leva o resto e trunca.
          Em 1280: 1280 - 210 (sidebar) - 40 (main) - 32 (card) = 998px, logo Resumo >= ~486px.
          Competência 144 (maior texto "Setembro de 2026" ~ 115px), Status 96 (badge "Publicado" ~ 66px),
          datas 96 (dd/mm/aaaa ~ 70px; cabeçalho "Atualizado em" ~ 78px), Ações 80 (2 botões de 28px + 8px).
        */}
        <colgroup>
          <col className="w-36" />
          <col />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-20" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Competência</TableHead>
            <TableHead>Resumo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Publicado em</TableHead>
            <TableHead>Atualizado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relatorios.map((relatorio) => (
            <RelatorioLinha
              key={relatorio.id}
              relatorio={relatorio}
              to={detalhePath(relatorio.id)}
              ocupado={excluindoId === relatorio.id}
              onAskDelete={onAskDelete}
            />
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
