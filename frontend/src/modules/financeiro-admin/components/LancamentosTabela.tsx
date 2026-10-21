import { type ChangeEvent, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { LancamentoLinha } from './LancamentoLinha';

interface LancamentosTabelaProps {
  lancamentos: LancamentoAdmin[];
  /** Ids marcados (só da página atual). */
  selecionados: string[];
  gravandoId: string | null;
  onSelect: (id: string, marcado: boolean) => void;
  onSelectAll: (marcado: boolean) => void;
  onVisibilidade: (lancamento: LancamentoAdmin, visivelCliente: boolean) => void;
  onEdit: (lancamento: LancamentoAdmin) => void;
  onDelete: (lancamento: LancamentoAdmin) => void;
}

/** Tabela de lançamentos (protótipo: docs/design/capturas/financeiro-lancamentos.png, dentro de um Card). */
export const LancamentosTabela = ({
  lancamentos,
  selecionados,
  gravandoId,
  onSelect,
  onSelectAll,
  onVisibilidade,
  onEdit,
  onDelete,
}: LancamentosTabelaProps) => {
  // Hooks
  const todosRef = useRef<HTMLInputElement>(null);

  // Constants derivadas
  const marcados = lancamentos.filter((l) => selecionados.includes(l.id)).length;
  const todos = lancamentos.length > 0 && marcados === lancamentos.length;
  const parcial = marcados > 0 && !todos;

  // Functions
  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => onSelectAll(e.target.checked);

  // Effects
  useEffect(() => {
    if (todosRef.current) todosRef.current.indeterminate = parcial;
  }, [parcial]);

  // Return
  return (
    <Card>
      <CardContent>
        <Table className="table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
          {/*
            Larguras fixas somam 744px (padding de 6px por lado em cada célula): checkbox 36, Data 84, Competência 128,
            Categoria 112, Valor 128, Anexos 56, Visível ao cliente 128, Ações 72. A Descrição (sem largura) leva o resto e trunca.
            Em 1280: 1280 - 210 (sidebar) - 40 (main) - 32 (card) = 998px, logo Descrição >= ~254px (~239px com barra de rolagem).
            Conteúdo real mais longo por coluna: "10/09/2026" ~65px (cabe em 72); "Setembro de 2026" ~111px (cabe em 116);
            badge "Equipamento" ~84px (cabe em 100); "R$ 12.345.678,90" ~101px (cabe em 116; o resto trunca com title);
            badge "Liberado" 64px + 8 + interruptor 36px = 108px (cabe em 116; cabeçalho "Visível ao cliente" ~103px);
            clipe + "10" ~32px (cabe em 44); dois botões de 28px = 56px (cabe em 60).
          */}
          <colgroup>
            <col className="w-9" />
            <col className="w-21" />
            <col className="w-32" />
            <col className="w-28" />
            <col />
            <col className="w-32" />
            <col className="w-14" />
            <col className="w-32" />
            <col className="w-18" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <input
                  ref={todosRef}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={todos}
                  onChange={handleSelectAll}
                  aria-label="Selecionar todos os lançamentos desta página"
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Competência</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Anexos</TableHead>
              <TableHead>Visível ao cliente</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lancamentos.map((lancamento) => (
              <LancamentoLinha
                key={lancamento.id}
                lancamento={lancamento}
                selecionado={selecionados.includes(lancamento.id)}
                gravandoId={gravandoId}
                onSelect={onSelect}
                onVisibilidade={onVisibilidade}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
