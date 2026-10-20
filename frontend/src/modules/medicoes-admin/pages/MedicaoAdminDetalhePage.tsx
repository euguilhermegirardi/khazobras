import { CircleCheck, Clock, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/KpiCard';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEtapas } from '@/hooks/useEtapas';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { EmitirNfDialog } from '../components/EmitirNfDialog';
import { MedicaoItensTabela } from '../components/MedicaoItensTabela';
import { MedicaoStatusBadge } from '../components/MedicaoStatusBadge';
import { TEXTO_AGUARDANDO_CLIENTE } from '../constants';
import { useMedicaoAdmin } from '../hooks';

const MENSAGEM_ERRO = 'Não foi possível carregar a medição.';
const MENSAGEM_OUTRA_OBRA = 'Medição não encontrada nesta obra.';

export const MedicaoAdminDetalhePage = () => {
  // Estados
  const [nfAberta, setNfAberta] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Hooks
  const { obraId = '', medicaoId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useMedicaoAdmin(obraId, medicaoId);
  const etapas = useEtapas(obraId);

  // Functions
  const handleRetry = () => void refetch();
  const handleEmitir = () => {
    setFeedback(null);
    setNfAberta(true);
  };
  const handleCloseNf = () => setNfAberta(false);
  const handleNfSaved = (mensagem: string) => {
    setNfAberta(false);
    setFeedback(mensagem);
  };

  // Retornos breves
  const voltar = (
    <Link to={`/admin/obras/${obraId}/medicoes`} className="text-[13px] text-info underline-offset-4 hover:underline">
      ← Voltar para as medições
    </Link>
  );

  if (isPending) {
    return (
      <PageSection title="Medição" actions={voltar}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando medição…</span>
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection title="Medição" actions={voltar}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    );
  }

  // Uma medição de outra obra aberta por URL adulterada não é exibida (o backend já barra o que não é permitido).
  if (data.obraId !== obraId) {
    return (
      <PageSection title="Medição" actions={voltar}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          {MENSAGEM_OUTRA_OBRA}
        </p>
      </PageSection>
    );
  }

  // Constants derivadas
  const etapaNome = data.etapaId ? etapas.data?.find((e) => e.id === data.etapaId)?.nome : undefined;
  const descricao = `Competência: ${formatMonthYearTitle(data.competencia)} · Etapa: ${etapaNome ?? (data.etapaId ? 'não identificada' : '—')}`;
  const botaoEmitir =
    data.status === 'Approved' ? (
      <Button type="button" onClick={handleEmitir}>
        Emitir NF
      </Button>
    ) : undefined;

  // Return
  return (
    <PageSection
      title={`Medição ${data.numero}`}
      description={descricao}
      actions={
        <>
          {voltar}
          {botaoEmitir}
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Valor total" value={formatCurrency(data.valorTotal)} tone="success" />
          <KpiCard label="Itens" value={data.itens.length} tone="warning" />
          <KpiCard label="Status" value={<MedicaoStatusBadge status={data.status} />} />
          <KpiCard label="Criada em" value={formatTimestamp(data.createdAt)} tone="neutral" />
        </div>

        {data.status === 'PendingApproval' && (
          <Alert variant="warning">
            <Clock aria-hidden />
            <AlertDescription>
              <p>{TEXTO_AGUARDANDO_CLIENTE}</p>
            </AlertDescription>
          </Alert>
        )}

        {data.status === 'Approved' && (
          <Alert variant="success">
            <CircleCheck aria-hidden />
            <AlertDescription>
              <p>
                {data.approvedAt ? `Aprovada pelo cliente em ${formatTimestamp(data.approvedAt)}. ` : 'Aprovada. '}
                Emita a nota fiscal.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {data.status === 'InvoiceIssued' && (
          <Alert variant="info">
            <Receipt aria-hidden />
            <AlertDescription>
              <p>
                {data.nfNumber ? `NF nº ${data.nfNumber}` : 'NF emitida'}
                {data.nfIssuedAt ? `, emitida em ${formatTimestamp(data.nfIssuedAt)}` : ''}.
                {data.approvedAt ? ` Medição aprovada pelo cliente em ${formatTimestamp(data.approvedAt)}.` : ''}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Itens da medição</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicaoItensTabela itens={data.itens} valorTotal={data.valorTotal} />
          </CardContent>
        </Card>
      </div>

      {nfAberta && (
        <EmitirNfDialog
          obraId={obraId}
          medicaoId={medicaoId}
          numero={data.numero}
          onClose={handleCloseNf}
          onSaved={handleNfSaved}
        />
      )}
    </PageSection>
  );
};
