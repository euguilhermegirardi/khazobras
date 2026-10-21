import { type ChangeEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErroAlert } from '@/components/ErroAlert';
import { ErrorState } from '@/components/ErrorState';
import { FormField } from '@/components/FormField';
import { PageSection } from '@/components/PageSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import type { RelatorioMensalAdmin } from '@/interfaces/relatorioMensal';
import { formatMonthYearTitle } from '@/utils/dates';
import type { MensagemErro } from '@/utils/erros';
import { ExcluirRelatorioConfirmacao } from '../components/ExcluirRelatorioConfirmacao';
import { RelatoriosTabela } from '../components/RelatoriosTabela';
import { FILTRO_STATUS_OPCOES } from '../constants';
import { useExcluirRelatorio, useRelatoriosAdmin } from '../hooks';
import { type FiltroStatus, filtrarPorStatus, mensagemDeAcao, ordenarPorCompetencia } from '../relatorioLista';

const TITULO = 'Relatório ao cliente';
const DESCRICAO =
  'Escreva o relatório de cada mês e publique para o cliente. O cliente só vê os publicados; depois de publicado, não dá para editar nem excluir.';
const MENSAGEM_ERRO = 'Não foi possível carregar os relatórios.';
const NAO_ENCONTRADO = 'Relatório não encontrado. Atualize a página.';
const CONFLITO_EXCLUIR = 'Este relatório já foi publicado e não pode ser excluído. A lista foi atualizada.';

export const RelatorioAdminListaPage = () => {
  // Estados
  const [filtro, setFiltro] = useState<FiltroStatus>('todos');
  const [excluindo, setExcluindo] = useState<RelatorioMensalAdmin | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<MensagemErro | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useRelatoriosAdmin(obraId);
  const excluir = useExcluirRelatorio(obraId);

  // Functions
  const limparMensagens = () => {
    setFeedback(null);
    setErroAcao(null);
  };

  const handleRetry = () => void refetch();

  const handleFiltro = (evento: ChangeEvent<HTMLSelectElement>) => setFiltro(evento.target.value as FiltroStatus);

  const handleAskDelete = (relatorio: RelatorioMensalAdmin) => {
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
      setFeedback('Rascunho excluído.');
    } catch (e) {
      setExcluindo(null);
      setErroAcao(
        mensagemDeAcao(e, 'Não foi possível excluir o rascunho. Tente novamente.', NAO_ENCONTRADO, CONFLITO_EXCLUIR),
      );
    }
  };

  const handleConfirmDeleteClick = () => void handleConfirmDelete();

  const novoPath = `/admin/obras/${obraId}/relatorio-ao-cliente/novo`;
  const detalhePath = (relatorioId: string) => `/admin/obras/${obraId}/relatorio-ao-cliente/${relatorioId}`;

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando relatórios…</span>
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-56 rounded-xl" />
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

  // Constants derivadas
  const relatorios = filtrarPorStatus(ordenarPorCompetencia(data), filtro);
  const botaoNovo = (
    <Button asChild>
      <Link to={novoPath}>+ Novo relatório</Link>
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
        {erroAcao && <ErroAlert erro={erroAcao} />}
        {excluindo && (
          <ExcluirRelatorioConfirmacao
            titulo={formatMonthYearTitle(excluindo.competencia)}
            ocupado={excluir.isPending}
            onConfirm={handleConfirmDeleteClick}
            onCancel={handleCancelDelete}
          />
        )}

        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">Nenhum relatório ao cliente</p>
            <p className="mt-1 text-[13px]">Use “+ Novo relatório” para escrever o do primeiro mês.</p>
          </div>
        ) : (
          <>
            <div className="w-56">
              <FormField id="filtro-status" label="Status">
                {(c) => (
                  <NativeSelect {...c} value={filtro} onChange={handleFiltro}>
                    {FILTRO_STATUS_OPCOES.map((opcao) => (
                      <option key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </div>
            {relatorios.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
                Nenhum relatório com este status.
              </p>
            ) : (
              <RelatoriosTabela
                relatorios={relatorios}
                detalhePath={detalhePath}
                excluindoId={excluir.isPending ? (excluindo?.id ?? null) : null}
                onAskDelete={handleAskDelete}
              />
            )}
          </>
        )}
      </div>
    </PageSection>
  );
};
