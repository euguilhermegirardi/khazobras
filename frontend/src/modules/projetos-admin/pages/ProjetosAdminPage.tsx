import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErroAlert } from '@/components/ErroAlert';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useEtapas } from '@/hooks/useEtapas';
import { type ProjetoAcao, useAcaoProjeto, useProjetos } from '@/hooks/useProjetos';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { agruparProjetos } from '@/utils/agruparProjetos';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { ExcluirProjetoConfirmacao } from '../components/ExcluirProjetoConfirmacao';
import { ProjetoEditDialog } from '../components/ProjetoEditDialog';
import { ProjetosGrupoCard } from '../components/ProjetosGrupoCard';
import { ProjetosUploadSecao } from '../components/ProjetosUploadSecao';
import { TITULO_ETAPA_DESCONHECIDA, TITULO_SEM_ETAPA } from '../constants';
import { useExcluirProjeto } from '../hooks';

const TITULO = 'Projetos';
const DESCRICAO =
  'Envie as plantas e os documentos técnicos da obra. O cliente vê os documentos por etapa, assim que são enviados.';
const MENSAGEM_ERRO = 'Não foi possível carregar os projetos.';
const NAO_ENCONTRADO = 'Documento não encontrado. Atualize a página.';
const TITULOS = { semEtapa: TITULO_SEM_ETAPA, desconhecida: TITULO_ETAPA_DESCONHECIDA };

export const ProjetosAdminPage = () => {
  // Estados
  const [editando, setEditando] = useState<ProjetoDocumento | null>(null);
  const [excluindo, setExcluindo] = useState<ProjetoDocumento | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroExcluir, setErroExcluir] = useState<MensagemErro | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useProjetos(obraId);
  // Sem o nome da etapa a tela segue com títulos genéricos (por isso o erro daqui é ignorado)
  const { data: etapas, isPending: etapasPending } = useEtapas(obraId);
  const acao = useAcaoProjeto();
  const excluir = useExcluirProjeto(obraId);

  // Constants derivadas
  const ocupadoId = acao.isPending
    ? (acao.variables?.projeto.id ?? null)
    : excluir.isPending
      ? (excluindo?.id ?? null)
      : null;
  const erroAcao = acao.isError
    ? toMensagemErro(acao.error, 'Não foi possível abrir o arquivo. Tente novamente.', NAO_ENCONTRADO)
    : null;

  // Functions
  const limparMensagens = () => {
    setFeedback(null);
    setErroExcluir(null);
    acao.reset();
  };

  const handleRetry = () => void refetch();

  const handleAcao = (projeto: ProjetoDocumento, tipo: ProjetoAcao) => {
    limparMensagens();
    acao.mutate({ projeto, acao: tipo });
  };

  const handleEdit = (projeto: ProjetoDocumento) => {
    limparMensagens();
    setExcluindo(null);
    setEditando(projeto);
  };

  const handleCloseEdit = () => setEditando(null);

  const handleSaved = (mensagem: string) => {
    setEditando(null);
    setFeedback(mensagem);
  };

  const handleAskDelete = (projeto: ProjetoDocumento) => {
    limparMensagens();
    setExcluindo(projeto);
  };

  const handleCancelDelete = () => setExcluindo(null);

  const handleConfirmDelete = async () => {
    if (!excluindo) return;
    limparMensagens();
    try {
      await excluir.mutateAsync(excluindo.id);
      setExcluindo(null);
      setFeedback('Documento excluído.');
    } catch (e) {
      setExcluindo(null);
      setErroExcluir(toMensagemErro(e, 'Não foi possível excluir o documento. Tente novamente.', NAO_ENCONTRADO));
    }
  };

  const handleConfirmDeleteClick = () => void handleConfirmDelete();

  // Retornos breves
  if (isPending || etapasPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando projetos…</span>
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
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

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
        {erroAcao && <ErroAlert erro={erroAcao} />}
        {erroExcluir && <ErroAlert erro={erroExcluir} />}

        <ProjetosUploadSecao obraId={obraId} jaNaObra={data.length} etapas={etapas ?? []} />

        {excluindo && (
          <ExcluirProjetoConfirmacao
            projeto={excluindo}
            ocupado={excluir.isPending}
            onConfirm={handleConfirmDeleteClick}
            onCancel={handleCancelDelete}
          />
        )}

        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">Nenhum documento enviado ainda</p>
            <p className="mt-1 text-[13px]">Use a área acima para enviar a primeira planta ou documento técnico.</p>
          </div>
        ) : (
          agruparProjetos(data, etapas ?? [], TITULOS).map((grupo) => (
            <ProjetosGrupoCard
              key={grupo.key}
              titulo={grupo.titulo}
              projetos={grupo.projetos}
              ocupadoId={ocupadoId}
              onAcao={handleAcao}
              onEdit={handleEdit}
              onAskDelete={handleAskDelete}
            />
          ))
        )}
      </div>

      {editando && (
        <ProjetoEditDialog obraId={obraId} projeto={editando} onClose={handleCloseEdit} onSaved={handleSaved} />
      )}
    </PageSection>
  );
};
