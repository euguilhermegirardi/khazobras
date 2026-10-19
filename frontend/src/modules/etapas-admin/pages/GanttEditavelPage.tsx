import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { EtapaFormDialog } from '../components/EtapaFormDialog';
import { EtapasTabela } from '../components/EtapasTabela';
import { MENSAGEM_VAZIO } from '../constants';
import { useEtapasGantt } from '../hooks';

/** Diálogo aberto: `etapa` null = criação. Fechado = null. */
interface DialogState {
  etapa: EtapaCronograma | null;
}

const TITULO = 'Gantt editável';
const DESCRICAO = 'Edite etapas, % e status. O cronograma do cliente usa estes dados.';
const MENSAGEM_ERRO = 'Não foi possível carregar as etapas.';

export const GanttEditavelPage = () => {
  // Estados
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useEtapasGantt(obraId);

  // Functions
  const handleRetry = () => void refetch();
  const handleNew = () => {
    setFeedback(null);
    setDialog({ etapa: null });
  };
  const handleEdit = (etapa: EtapaCronograma) => {
    setFeedback(null);
    setDialog({ etapa });
  };
  const handleClose = () => setDialog(null);
  const handleSaved = (mensagem: string) => {
    setDialog(null);
    setFeedback(mensagem);
  };

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Carregando etapas…</span>
          <Skeleton className="h-72 rounded-xl" />
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

  // Constants derivadas (a lista chega ordenada por `ordem`)
  const proximaOrdem = data.reduce((maior, etapa) => Math.max(maior, etapa.ordem), 0) + 1;
  const botaoNova = (
    <Button type="button" onClick={handleNew}>
      + Etapa
    </Button>
  );

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO} actions={data.length > 0 ? botaoNova : undefined}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">{MENSAGEM_VAZIO}</p>
            <p className="mt-1 mb-3.5 text-[13px]">Cadastre a primeira etapa desta obra.</p>
            {botaoNova}
          </div>
        ) : (
          <EtapasTabela etapas={data} onEdit={handleEdit} />
        )}
      </div>
      {dialog && (
        <EtapaFormDialog
          obraId={obraId}
          etapa={dialog.etapa}
          proximaOrdem={proximaOrdem}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </PageSection>
  );
};
