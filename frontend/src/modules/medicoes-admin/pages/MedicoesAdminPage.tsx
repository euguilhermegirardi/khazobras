import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { FormField } from '@/components/FormField';
import { PageSection } from '@/components/PageSection';
import { Pagination } from '@/components/Pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import type { MedicaoStatusFiltro } from '@/interfaces/medicao';
import { MedicaoFormDialog } from '../components/MedicaoFormDialog';
import { MedicoesKpis } from '../components/MedicoesKpis';
import { MedicoesTabela } from '../components/MedicoesTabela';
import { PAGE_SIZE, STATUS_FILTRO_OPCOES } from '../constants';
import { useMedicoesResumo, useMedicoesTotal } from '../hooks';
import { proximoNumero } from '../medicaoForm';

const TITULO = 'Medições';
const DESCRICAO = 'Acompanhe o status das medições da obra, crie novas e emita a nota fiscal das aprovadas.';
const MENSAGEM_ERRO = 'Não foi possível carregar as medições.';
const MENSAGEM_VAZIO = 'Nenhuma medição foi criada nesta obra ainda.';
const MENSAGEM_VAZIO_FILTRO = 'Nenhuma medição com este status.';

export const MedicoesAdminPage = () => {
  // Estados
  const [pageIndex, setPageIndex] = useState(0);
  const [status, setStatus] = useState<'' | MedicaoStatusFiltro>('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useMedicoesResumo(
    obraId,
    pageIndex,
    status || undefined,
  );
  const total = useMedicoesTotal(obraId);

  // Constants derivadas
  const filtrando = status !== '';
  const maiorNumeroDaPagina = (data?.items ?? []).reduce((maior, m) => Math.max(maior, m.numero), 0);
  const numeroSugerido = proximoNumero(maiorNumeroDaPagina, total.data ?? 0);

  // Functions
  const handleRetry = () => void refetch();
  const handleNew = () => {
    setFeedback(null);
    setDialogAberto(true);
  };
  const handleClose = () => setDialogAberto(false);
  const handleSaved = (mensagem: string) => {
    setDialogAberto(false);
    setFeedback(mensagem);
    // A nova medição aparece no topo da lista sem filtro.
    setStatus('');
    setPageIndex(0);
  };
  const handleStatusChange = (valor: string) => {
    setStatus(valor as '' | MedicaoStatusFiltro);
    setPageIndex(0);
  };

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando medições…</span>
          <Skeleton className="h-20 rounded-md" />
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

  const botaoNova = (
    <Button type="button" onClick={handleNew}>
      + Nova medição
    </Button>
  );
  const vazioSemFiltro = data.totalItems === 0 && !filtrando;

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO} actions={botaoNova}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}

        <MedicoesKpis obraId={obraId} total={total.data} />

        {vazioSemFiltro ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">{MENSAGEM_VAZIO}</p>
            <p className="mt-1 text-[13px]">Use “+ Nova medição” para criar a primeira.</p>
          </div>
        ) : (
          <>
            <div className="w-64">
              <FormField id="medicoes-filtro-status" label="Filtrar por status">
                {(c) => (
                  <NativeSelect {...c} value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                    {STATUS_FILTRO_OPCOES.map((opcao) => (
                      <option key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </div>

            {data.items.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
                {MENSAGEM_VAZIO_FILTRO}
              </p>
            ) : (
              <div>
                <MedicoesTabela obraId={obraId} medicoes={data.items} />
                <Pagination
                  label="Paginação das medições"
                  pageIndex={data.pageIndex}
                  pageSize={PAGE_SIZE}
                  totalItems={data.totalItems}
                  totalText={data.totalItems === 1 ? '1 medição' : `${data.totalItems} medições`}
                  busy={isPlaceholderData}
                  onChange={setPageIndex}
                />
              </div>
            )}
          </>
        )}
      </div>

      {dialogAberto && (
        <MedicaoFormDialog obraId={obraId} proximoNumero={numeroSugerido} onClose={handleClose} onSaved={handleSaved} />
      )}
    </PageSection>
  );
};
