import { ArrowLeft, Lock, Send, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErroAlert } from '@/components/ErroAlert';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { RelatorioMensalCard } from '@/components/RelatorioMensalCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMonthYearTitle, formatTimestamp } from '@/utils/dates';
import type { MensagemErro } from '@/utils/erros';
import { ExcluirRelatorioConfirmacao } from '../components/ExcluirRelatorioConfirmacao';
import { PublicarConfirmacao } from '../components/PublicarConfirmacao';
import { RelatorioEditor } from '../components/RelatorioEditor';
import { RelatorioHistoricoCard } from '../components/RelatorioHistoricoCard';
import { RelatorioStatusBadge } from '../components/RelatorioStatusBadge';
import { removerRelatorioDoCache, useExcluirRelatorio, usePublicarRelatorio, useRelatorioAdmin } from '../hooks';
import { mensagemDeAcao } from '../relatorioLista';
import type { RelatorioNavState } from '../types';

const TITULO = 'Relatório ao cliente';
const MENSAGEM_ERRO = 'Não foi possível carregar o relatório.';
const NAO_ENCONTRADO = 'Relatório não encontrado. Volte à lista e atualize a página.';
const CONFLITO_PUBLICAR = 'Este relatório já foi publicado. A página foi atualizada.';
const CONFLITO_EXCLUIR = 'Este relatório já foi publicado e não pode ser excluído. A página foi atualizada.';

export const RelatorioAdminDetalhePage = () => {
  // Estados
  const location = useLocation();
  const [publicando, setPublicando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(
    () => (location.state as RelatorioNavState | null)?.feedback ?? null,
  );
  const [erroAcao, setErroAcao] = useState<MensagemErro | null>(null);
  const excluidoRef = useRef(false);
  // Hooks
  const queryClient = useQueryClient();
  const { obraId = '', relatorioId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useRelatorioAdmin(obraId, relatorioId);
  const publicar = usePublicarRelatorio(obraId);
  const excluir = useExcluirRelatorio(obraId, false);

  // Constants derivadas
  const listaPath = `/admin/obras/${obraId}/relatorio-ao-cliente`;

  // Effects: depois de apagar e sair da tela, o detalhe e o histórico saem do cache (com a página montada o observer os buscaria de novo).
  useEffect(
    () => () => {
      if (excluidoRef.current) removerRelatorioDoCache(queryClient, obraId, relatorioId);
    },
    [queryClient, obraId, relatorioId],
  );

  // Functions
  const limparMensagens = () => {
    setFeedback(null);
    setErroAcao(null);
  };

  const handleRetry = () => void refetch();

  const handleAskPublish = () => {
    limparMensagens();
    setExcluindo(false);
    setPublicando(true);
  };

  const handleCancelPublish = () => setPublicando(false);

  const handleConfirmPublish = async () => {
    limparMensagens();
    try {
      await publicar.mutateAsync(relatorioId);
      setPublicando(false);
      setFeedback('Relatório publicado. O cliente já pode vê-lo.');
    } catch (e) {
      setPublicando(false);
      setErroAcao(
        mensagemDeAcao(e, 'Não foi possível publicar o relatório. Tente novamente.', NAO_ENCONTRADO, CONFLITO_PUBLICAR),
      );
    }
  };

  const handleConfirmPublishClick = () => void handleConfirmPublish();

  const handleAskDelete = () => {
    limparMensagens();
    setPublicando(false);
    setExcluindo(true);
  };

  const handleCancelDelete = () => setExcluindo(false);

  const handleConfirmDelete = async () => {
    limparMensagens();
    try {
      await excluir.mutateAsync(relatorioId);
      excluidoRef.current = true;
      navigate(listaPath);
    } catch (e) {
      setExcluindo(false);
      setErroAcao(
        mensagemDeAcao(e, 'Não foi possível excluir o rascunho. Tente novamente.', NAO_ENCONTRADO, CONFLITO_EXCLUIR),
      );
    }
  };

  const handleConfirmDeleteClick = () => void handleConfirmDelete();

  const handleCancelEdit = () => navigate(listaPath);

  const handleSaved = (mensagem: string) => {
    setErroAcao(null);
    setFeedback(mensagem);
  };

  const voltar = (
    <Button asChild variant="outline">
      <Link to={listaPath}>
        <ArrowLeft aria-hidden />
        Relatórios
      </Link>
    </Button>
  );

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} actions={voltar}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando relatório…</span>
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection title={TITULO} actions={voltar}>
        <ErrorState error={error} fallbackMessage={MENSAGEM_ERRO} onRetry={handleRetry} />
      </PageSection>
    );
  }

  // Relatório de outra obra na URL: o backend deixa o admin ler, mas não é desta obra.
  if (data.obraId !== obraId) {
    return (
      <PageSection title={TITULO} actions={voltar}>
        <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
          Relatório não encontrado nesta obra.
        </p>
      </PageSection>
    );
  }

  const titulo = formatMonthYearTitle(data.competencia);
  const rascunho = data.status === 'draft';
  const detalhe = [
    `Criado em ${formatTimestamp(data.createdAt)}`,
    `atualizado em ${formatTimestamp(data.updatedAt)}`,
    data.publishedAt ? `publicado em ${formatTimestamp(data.publishedAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const acoes = (
    <>
      <RelatorioStatusBadge status={data.status} />
      {voltar}
      {rascunho && (
        <>
          <Button type="button" onClick={handleAskPublish}>
            <Send aria-hidden />
            Publicar
          </Button>
          <Button type="button" variant="outline" className="text-danger" onClick={handleAskDelete}>
            <Trash2 aria-hidden />
            Excluir rascunho
          </Button>
        </>
      )}
    </>
  );

  // Return
  return (
    <PageSection title={`Relatório de ${titulo}`} description={detalhe} actions={acoes}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
        {erroAcao && <ErroAlert erro={erroAcao} />}
        {publicando && (
          <PublicarConfirmacao
            titulo={titulo}
            ocupado={publicar.isPending}
            onConfirm={handleConfirmPublishClick}
            onCancel={handleCancelPublish}
          />
        )}
        {excluindo && (
          <ExcluirRelatorioConfirmacao
            titulo={titulo}
            ocupado={excluir.isPending}
            onConfirm={handleConfirmDeleteClick}
            onCancel={handleCancelDelete}
          />
        )}

        {rascunho ? (
          <RelatorioEditor
            key={data.id}
            obraId={obraId}
            relatorio={data}
            onCancel={handleCancelEdit}
            onSaved={handleSaved}
          />
        ) : (
          <>
            <Alert variant="info">
              <Lock aria-hidden />
              <AlertDescription>
                Relatório publicado: somente leitura. O cliente já o vê e não é possível editar nem excluir.
              </AlertDescription>
            </Alert>
            <section aria-label="Como o cliente vê" className="flex flex-col gap-2">
              <h2 className="text-[13px] font-medium text-muted-foreground">Como o cliente vê</h2>
              <RelatorioMensalCard relatorio={data} />
            </section>
          </>
        )}

        <RelatorioHistoricoCard obraId={obraId} relatorioId={data.id} />
      </div>
    </PageSection>
  );
};
