import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ContratosKpis } from '@/components/ContratosKpis';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Contrato } from '@/interfaces/contrato';
import { ContratoAdminCard } from '../components/ContratoAdminCard';
import { ContratoFormDialog } from '../components/ContratoFormDialog';
import { PagamentoFormDialog } from '../components/PagamentoFormDialog';
import { useContratosAdmin } from '../hooks';

const TITULO = 'Contratos';
const DESCRICAO = 'Contratos da obra e pagamentos recebidos do cliente.';
const MENSAGEM_ERRO = 'Não foi possível carregar os contratos.';

export const ContratosAdminPage = () => {
  // Estados
  const [novoAberto, setNovoAberto] = useState(false);
  const [contratoDoPagamento, setContratoDoPagamento] = useState<Contrato | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useContratosAdmin(obraId);

  // Functions
  const handleRetry = () => void refetch();
  const handleNovo = () => {
    setFeedback(null);
    setNovoAberto(true);
  };
  const handleRegistrarPagamento = (contrato: Contrato) => {
    setFeedback(null);
    setContratoDoPagamento(contrato);
  };
  const handleCloseNovo = () => setNovoAberto(false);
  const handleClosePagamento = () => setContratoDoPagamento(null);
  const handleSaved = (mensagem: string) => {
    setNovoAberto(false);
    setContratoDoPagamento(null);
    setFeedback(mensagem);
  };

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando contratos…</span>
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    );
  }

  const botaoNovo = (
    <Button type="button" onClick={handleNovo}>
      + Novo contrato
    </Button>
  );

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO} actions={botaoNovo}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}

        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">Nenhum contrato registrado nesta obra ainda</p>
            <p className="mt-1 text-[13px]">Use “+ Novo contrato” para criar o primeiro.</p>
          </div>
        ) : (
          <>
            <ContratosKpis contratos={data} />
            {data.map((contrato) => (
              <ContratoAdminCard
                key={contrato.id}
                obraId={obraId}
                contrato={contrato}
                onRegistrarPagamento={handleRegistrarPagamento}
              />
            ))}
          </>
        )}
      </div>

      {novoAberto && <ContratoFormDialog obraId={obraId} onClose={handleCloseNovo} onSaved={handleSaved} />}
      {contratoDoPagamento && (
        <PagamentoFormDialog
          obraId={obraId}
          contratoId={contratoDoPagamento.id}
          numeroContrato={contratoDoPagamento.numero}
          onClose={handleClosePagamento}
          onSaved={handleSaved}
        />
      )}
    </PageSection>
  );
};
