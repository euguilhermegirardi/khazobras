import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErroAlert } from '@/components/ErroAlert';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEtapas } from '@/hooks/useEtapas';
import { useRelatoriosFotograficos } from '@/hooks/useRelatoriosFotograficos';
import type { RelatorioFotografico, RelatorioFotograficoTipo } from '@/interfaces/relatorioFotografico';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { tituloDoRelatorio } from '@/utils/relatorioFotografico';
import { ExcluirRelatorioConfirmacao } from '../components/ExcluirRelatorioConfirmacao';
import { RelatorioFormDialog } from '../components/RelatorioFormDialog';
import { RelatoriosAdminLista } from '../components/RelatoriosAdminLista';
import { TABS } from '../constants';
import { useExcluirRelatorio } from '../hooks';

const TITULO = 'Relatório fotográfico';
const DESCRICAO =
  'Crie os relatórios por mês ou por etapa e envie as fotos. O cliente da obra vê todos os relatórios, assim que são criados.';
const MENSAGEM_ERRO = 'Não foi possível carregar os relatórios fotográficos.';
const NAO_ENCONTRADO = 'Relatório não encontrado. Atualize a página.';

export const RelatoriosFotograficosAdminPage = () => {
  // Estados
  const [aba, setAba] = useState<RelatorioFotograficoTipo>('mensal');
  /** `null` = fechado; `{ relatorio: null }` = novo; `{ relatorio }` = editar. */
  const [dialogo, setDialogo] = useState<{ relatorio: RelatorioFotografico | null } | null>(null);
  const [excluindo, setExcluindo] = useState<RelatorioFotografico | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<MensagemErro | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useRelatoriosFotograficos(obraId);
  // Sem o nome da etapa a tela segue com o título do relatório (por isso o erro daqui é ignorado)
  const { data: etapas } = useEtapas(obraId);
  const excluir = useExcluirRelatorio(obraId);

  // Functions
  const limparMensagens = () => {
    setFeedback(null);
    setErroAcao(null);
  };

  const handleRetry = () => void refetch();

  const handleNew = () => {
    limparMensagens();
    setExcluindo(null);
    setDialogo({ relatorio: null });
  };

  const handleEdit = (relatorio: RelatorioFotografico) => {
    limparMensagens();
    setExcluindo(null);
    setDialogo({ relatorio });
  };

  const handleCloseDialog = () => setDialogo(null);

  const handleSaved = (mensagem: string, salvo: RelatorioFotografico) => {
    setDialogo(null);
    setAba(salvo.tipo);
    setFeedback(mensagem);
  };

  const handleAskDelete = (relatorio: RelatorioFotografico) => {
    limparMensagens();
    setExcluindo(relatorio);
  };

  const handleCancelDelete = () => setExcluindo(null);

  const handleConfirmDelete = async () => {
    if (!excluindo) return;
    limparMensagens();
    try {
      await excluir.mutateAsync(excluindo.id);
      setExcluindo(null);
      setFeedback('Relatório excluído.');
    } catch (e) {
      setExcluindo(null);
      setErroAcao(toMensagemErro(e, 'Não foi possível excluir o relatório. Tente novamente.', NAO_ENCONTRADO));
    }
  };

  const handleConfirmDeleteClick = () => void handleConfirmDelete();

  const handleTabChange = (valor: string) => setAba(valor as RelatorioFotograficoTipo);

  const detalhePath = (relatorioId: string) => `/admin/obras/${obraId}/relatorio-fotografico/${relatorioId}`;

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando relatórios fotográficos…</span>
          <Skeleton className="h-9 w-48 rounded-md" />
          <div className="grid grid-cols-3 gap-3.5">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
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
    <Button type="button" onClick={handleNew}>
      + Novo relatório
    </Button>
  );
  const tituloExcluindo = excluindo
    ? tituloDoRelatorio(excluindo, etapas?.find((e) => e.id === excluindo.etapaId)?.nome)
    : '';

  // Return
  return (
    <PageSection title={TITULO} description={DESCRICAO} actions={botaoNovo}>
      <div className="flex flex-col gap-3.5">
        {feedback && (
          <Alert variant="success" role="status">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
        {erroAcao && <ErroAlert erro={erroAcao} />}
        {excluindo && (
          <ExcluirRelatorioConfirmacao
            relatorio={excluindo}
            titulo={tituloExcluindo}
            ocupado={excluir.isPending}
            onConfirm={handleConfirmDeleteClick}
            onCancel={handleCancelDelete}
          />
        )}

        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">Nenhum relatório fotográfico</p>
            <p className="mt-1 text-[13px]">Use “+ Novo relatório” para criar o primeiro e enviar as fotos.</p>
          </div>
        ) : (
          <Tabs value={aba} onValueChange={handleTabChange}>
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <RelatoriosAdminLista
                  tipo={tab.value}
                  relatorios={data}
                  etapas={etapas ?? []}
                  detalhePath={detalhePath}
                  onEdit={handleEdit}
                  onDelete={handleAskDelete}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {dialogo && (
        <RelatorioFormDialog
          obraId={obraId}
          relatorio={dialogo.relatorio}
          onClose={handleCloseDialog}
          onSaved={handleSaved}
        />
      )}
    </PageSection>
  );
};
