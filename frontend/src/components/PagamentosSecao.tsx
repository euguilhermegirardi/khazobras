import { ErrorState } from '@/components/ErrorState';
import { PagamentosTabela } from '@/components/PagamentosTabela';
import { Skeleton } from '@/components/ui/skeleton';
import type { PagamentoCliente } from '@/interfaces/contrato';

interface PagamentosSecaoProps {
  numeroContrato: string;
  /** `undefined` enquanto carrega ou se falhou. */
  pagamentos: PagamentoCliente[] | undefined;
  isPending: boolean;
  /** Erro da consulta do detalhe (ou `null`). */
  error: unknown;
  onRetry: () => void;
  /** Texto do estado vazio (cliente e admin falam diferente). */
  mensagemVazio: string;
}

/** Seção "Pagamentos" de um contrato com os quatro estados: carregando, erro, vazio e tabela. */
export const PagamentosSecao = ({
  numeroContrato,
  pagamentos,
  isPending,
  error,
  onRetry,
  mensagemVazio,
}: PagamentosSecaoProps) => {
  // Constants derivadas
  const titulo = `Pagamentos do contrato ${numeroContrato}`;

  // Return
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-muted-foreground">Pagamentos</h3>
      {isPending && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Carregando pagamentos…</span>
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md" />
        </div>
      )}
      {!isPending && error !== null && (
        <ErrorState error={error} fallbackMessage="Não foi possível carregar os pagamentos." onRetry={onRetry} />
      )}
      {!isPending && error === null && pagamentos !== undefined && pagamentos.length === 0 && (
        <p className="rounded-md border border-dashed py-4 text-center text-[13px] text-muted-foreground">
          {mensagemVazio}
        </p>
      )}
      {!isPending && error === null && pagamentos !== undefined && pagamentos.length > 0 && (
        <PagamentosTabela pagamentos={pagamentos} />
      )}
    </section>
  );
};
