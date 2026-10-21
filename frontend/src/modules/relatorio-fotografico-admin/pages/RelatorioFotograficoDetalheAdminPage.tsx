import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErroAlert } from '@/components/ErroAlert';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEtapas } from '@/hooks/useEtapas';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { formatTimestamp } from '@/utils/dates';
import { FOTO_MAX_POR_RELATORIO } from '@/utils/foto';
import { ordenarFotos, RELATORIO_TIPO_LABEL, tituloDoRelatorio } from '@/utils/relatorioFotografico';
import { ExcluirRelatorioConfirmacao } from '../components/ExcluirRelatorioConfirmacao';
import { FotosGrid } from '../components/FotosGrid';
import { FotosUploadSecao } from '../components/FotosUploadSecao';
import { RelatorioFormDialog } from '../components/RelatorioFormDialog';
import { useExcluirRelatorio, useRelatorio } from '../hooks';

const TITULO = 'Relatório fotográfico';
const MENSAGEM_ERRO = 'Não foi possível carregar o relatório.';
const NAO_ENCONTRADO = 'Relatório não encontrado. Volte à lista e atualize a página.';

export const RelatorioFotograficoDetalheAdminPage = () => {
  // Estados
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<MensagemErro | null>(null);
  // Hooks
  const { obraId = '', relatorioId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useRelatorio(obraId, relatorioId);
  // Sem o nome da etapa a tela segue com o título do relatório (por isso o erro daqui é ignorado)
  const { data: etapas } = useEtapas(obraId);
  const excluir = useExcluirRelatorio(obraId, false);

  // Constants derivadas
  const listaPath = `/admin/obras/${obraId}/relatorio-fotografico`;

  // Functions
  const handleRetry = () => void refetch();

  const handleEdit = () => {
    setFeedback(null);
    setErroAcao(null);
    setExcluindo(false);
    setEditando(true);
  };

  const handleCloseEdit = () => setEditando(false);

  const handleSaved = (mensagem: string) => {
    setEditando(false);
    setFeedback(mensagem);
  };

  const handleAskDelete = () => {
    setFeedback(null);
    setErroAcao(null);
    setExcluindo(true);
  };

  const handleCancelDelete = () => setExcluindo(false);

  const handleConfirmDelete = async () => {
    setErroAcao(null);
    try {
      await excluir.mutateAsync(relatorioId);
      navigate(listaPath);
    } catch (e) {
      setExcluindo(false);
      setErroAcao(toMensagemErro(e, 'Não foi possível excluir o relatório. Tente novamente.', NAO_ENCONTRADO));
    }
  };

  const handleConfirmDeleteClick = () => void handleConfirmDelete();

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
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
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

  const titulo = tituloDoRelatorio(data, etapas?.find((e) => e.id === data.etapaId)?.nome);
  const fotos = ordenarFotos(data.fotos);
  const detalhe = [
    RELATORIO_TIPO_LABEL[data.tipo],
    titulo !== data.titulo ? data.titulo : null,
    `registrado em ${formatTimestamp(data.createdAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const acoes = (
    <>
      {voltar}
      <Button type="button" variant="outline" onClick={handleEdit}>
        <Pencil aria-hidden />
        Editar dados
      </Button>
      <Button type="button" variant="outline" className="text-danger" onClick={handleAskDelete}>
        <Trash2 aria-hidden />
        Excluir relatório
      </Button>
    </>
  );

  // Return
  return (
    <PageSection title={titulo} description={detalhe} actions={acoes}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
        {erroAcao && <ErroAlert erro={erroAcao} />}
        {excluindo && (
          <ExcluirRelatorioConfirmacao
            relatorio={data}
            titulo={titulo}
            ocupado={excluir.isPending}
            onConfirm={handleConfirmDeleteClick}
            onCancel={handleCancelDelete}
          />
        )}

        <FotosUploadSecao obraId={obraId} relatorioId={data.id} jaNoRelatorio={fotos.length} />

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Fotos</h2>
              <Badge variant="neutral">
                {fotos.length} de {FOTO_MAX_POR_RELATORIO}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FotosGrid obraId={obraId} relatorioId={data.id} fotos={fotos} />
          </CardContent>
        </Card>
      </div>

      {editando && (
        <RelatorioFormDialog obraId={obraId} relatorio={data} onClose={handleCloseEdit} onSaved={handleSaved} />
      )}
    </PageSection>
  );
};
