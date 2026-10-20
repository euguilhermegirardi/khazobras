import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ErrorState';
import { PageSection } from '@/components/PageSection';
import { Pagination } from '@/components/Pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { LancamentoAdmin, LancamentosFiltros as Filtros } from '@/interfaces/financeiroAdmin';
import { ErroAlert } from '../components/ErroAlert';
import { ExcluirConfirmacao } from '../components/ExcluirConfirmacao';
import { FinanceiroKpis } from '../components/FinanceiroKpis';
import { LancamentoFormDialog } from '../components/LancamentoFormDialog';
import { LancamentosFiltros } from '../components/LancamentosFiltros';
import { LancamentosTabela } from '../components/LancamentosTabela';
import { SelecaoBarra } from '../components/SelecaoBarra';
import { COMPETENCIA_FILTRO, FILTROS_VAZIOS, LOTE_MAX, PAGE_SIZE } from '../constants';
import { toMensagemErro, type MensagemErro } from '../erros';
import {
  useAlterarVisibilidade,
  useAlterarVisibilidadeLote,
  useCategoriaOpcoes,
  useExcluirLancamento,
  useLancamentosAdmin,
  useResumo,
} from '../hooks';

const TITULO = 'Financeiro';
const DESCRICAO =
  'Lance os custos da obra, anexe os comprovantes e libere ao cliente só o que ele deve ver. Os totais abaixo são internos.';
const MENSAGEM_ERRO = 'Não foi possível carregar os lançamentos.';
const MENSAGEM_VAZIO = 'Nenhum lançamento nesta obra ainda.';
const MENSAGEM_VAZIO_FILTRO = 'Nenhum lançamento com estes filtros.';
const NAO_ENCONTRADO = 'Lançamento não encontrado. Atualize a página.';

/** Quantidade em frase: "1 lançamento" / "3 lançamentos". */
const qtdLancamentos = (n: number) => (n === 1 ? '1 lançamento' : `${n} lançamentos`);

export const FinanceiroAdminPage = () => {
  // Estados
  const [pageIndex, setPageIndex] = useState(0);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  /** `null` = fechado; `{ lancamento: null }` = novo; `{ lancamento }` = editar. */
  const [dialogo, setDialogo] = useState<{ lancamento: LancamentoAdmin | null } | null>(null);
  const [excluindo, setExcluindo] = useState<LancamentoAdmin | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<MensagemErro | null>(null);
  // Hooks
  const { obraId = '' } = useParams();
  // Competência pela metade (navegador sem input de mês) não filtra nem refaz a consulta.
  const filtrosEfetivos: Filtros = {
    ...filtros,
    competencia: COMPETENCIA_FILTRO.test(filtros.competencia) ? filtros.competencia : '',
  };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useLancamentosAdmin(
    obraId,
    pageIndex,
    filtrosEfetivos,
  );
  const resumo = useResumo(obraId);
  const categorias = useCategoriaOpcoes();
  const visibilidade = useAlterarVisibilidade(obraId);
  const lote = useAlterarVisibilidadeLote(obraId);
  const excluir = useExcluirLancamento(obraId);

  // Constants derivadas
  const filtrando = filtros.visivelCliente !== '' || filtros.categoria !== '' || filtros.competencia !== '';
  const itens = data?.items ?? [];
  // Só conta o que ainda está na página (um lançamento pode sair da lista depois de liberar, com filtro ativo).
  const selecionadosNaPagina = selecionados.filter((id) => itens.some((l) => l.id === id));
  const gravandoId = visibilidade.isPending ? (visibilidade.variables?.id ?? null) : null;
  // Edição: usa a versão mais nova da lista (anexos enviados/removidos), com o lançamento aberto como reserva.
  const lancamentoEmEdicao = dialogo?.lancamento
    ? (itens.find((l) => l.id === dialogo.lancamento?.id) ?? dialogo.lancamento)
    : null;

  // Functions
  const limparMensagens = () => {
    setFeedback(null);
    setErroAcao(null);
  };

  const handleRetry = () => void refetch();

  const handleFiltros = (novos: Filtros) => {
    setFiltros(novos);
    setPageIndex(0);
    setSelecionados([]);
    setExcluindo(null);
  };

  const handlePage = (novaPagina: number) => {
    setPageIndex(novaPagina);
    setSelecionados([]);
    setExcluindo(null);
  };

  const handleSelect = (id: string, marcado: boolean) =>
    setSelecionados((atuais) => (marcado ? [...new Set([...atuais, id])] : atuais.filter((x) => x !== id)));

  const handleSelectAll = (marcado: boolean) => setSelecionados(marcado ? itens.map((l) => l.id) : []);

  const handleClearSelection = () => setSelecionados([]);

  const handleNew = () => {
    limparMensagens();
    setDialogo({ lancamento: null });
  };

  const handleEdit = (lancamento: LancamentoAdmin) => {
    limparMensagens();
    setExcluindo(null);
    setDialogo({ lancamento });
  };

  const handleCloseDialog = () => setDialogo(null);

  const handleSaved = (mensagem: string) => {
    setDialogo(null);
    setFeedback(mensagem);
  };

  const handleVisibilidade = async (lancamento: LancamentoAdmin, visivelCliente: boolean) => {
    limparMensagens();
    try {
      await visibilidade.mutateAsync({ id: lancamento.id, visivelCliente });
      setFeedback(visivelCliente ? 'Lançamento liberado ao cliente.' : 'Lançamento ocultado do cliente.');
    } catch (e) {
      setErroAcao(toMensagemErro(e, 'Não foi possível alterar a visibilidade. Tente novamente.', NAO_ENCONTRADO));
    }
  };

  const handleLote = async (visivelCliente: boolean) => {
    limparMensagens();
    if (selecionadosNaPagina.length === 0 || selecionadosNaPagina.length > LOTE_MAX) return;
    try {
      const resposta = await lote.mutateAsync({ ids: selecionadosNaPagina, visivelCliente });
      setSelecionados([]);
      const n = resposta.atualizados;
      const acao = visivelCliente ? 'liberado' : 'ocultado';
      const destino = visivelCliente ? 'ao cliente' : 'do cliente';
      setFeedback(n === 1 ? `1 lançamento ${acao} ${destino}.` : `${n} lançamentos ${acao}s ${destino}.`);
    } catch (e) {
      // 400 `errors.Ids` (algum id não é desta obra) cai na mensagem do servidor: nada foi alterado.
      setErroAcao(
        toMensagemErro(e, 'Não foi possível alterar a visibilidade dos selecionados. Tente novamente.', NAO_ENCONTRADO),
      );
    }
  };

  const handleLiberarLote = () => void handleLote(true);
  const handleOcultarLote = () => void handleLote(false);

  const handleAskDelete = (lancamento: LancamentoAdmin) => {
    limparMensagens();
    setExcluindo(lancamento);
  };

  const handleCancelDelete = () => setExcluindo(null);

  const handleConfirmDelete = async () => {
    if (!excluindo) return;
    limparMensagens();
    try {
      await excluir.mutateAsync(excluindo.id);
      setExcluindo(null);
      setSelecionados((atuais) => atuais.filter((id) => id !== excluindo.id));
      // Era o único da última página: volta uma página em vez de mostrar uma página vazia.
      if (itens.length === 1 && pageIndex > 0) setPageIndex(pageIndex - 1);
      setFeedback('Lançamento excluído.');
    } catch (e) {
      setExcluindo(null);
      setErroAcao(toMensagemErro(e, 'Não foi possível excluir o lançamento. Tente novamente.', NAO_ENCONTRADO));
    }
  };

  const handleConfirmDeleteClick = () => void handleConfirmDelete();

  // Retornos breves
  if (isPending) {
    return (
      <PageSection title={TITULO} description={DESCRICAO}>
        <div role="status" className="flex flex-col gap-3.5">
          <span className="sr-only">Carregando lançamentos…</span>
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

  const botaoNovo = (
    <Button type="button" onClick={handleNew}>
      + Novo lançamento
    </Button>
  );
  const vazioSemFiltro = data.totalItems === 0 && !filtrando;

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
          <ExcluirConfirmacao
            lancamento={excluindo}
            ocupado={excluir.isPending}
            onConfirm={handleConfirmDeleteClick}
            onCancel={handleCancelDelete}
          />
        )}

        <FinanceiroKpis resumo={resumo.data} />

        {vazioSemFiltro ? (
          <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">{MENSAGEM_VAZIO}</p>
            <p className="mt-1 text-[13px]">Use “+ Novo lançamento” para registrar o primeiro.</p>
          </div>
        ) : (
          <>
            <LancamentosFiltros filtros={filtros} categorias={categorias} onChange={handleFiltros} />

            {selecionadosNaPagina.length > 0 && (
              <SelecaoBarra
                quantidade={selecionadosNaPagina.length}
                ocupado={lote.isPending}
                onLiberar={handleLiberarLote}
                onOcultar={handleOcultarLote}
                onLimpar={handleClearSelection}
              />
            )}

            {data.items.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
                {MENSAGEM_VAZIO_FILTRO}
              </p>
            ) : (
              <div>
                <LancamentosTabela
                  lancamentos={data.items}
                  selecionados={selecionados}
                  gravandoId={gravandoId}
                  onSelect={handleSelect}
                  onSelectAll={handleSelectAll}
                  onVisibilidade={(l, v) => void handleVisibilidade(l, v)}
                  onEdit={handleEdit}
                  onDelete={handleAskDelete}
                />
                <Pagination
                  label="Paginação dos lançamentos"
                  pageIndex={data.pageIndex}
                  pageSize={PAGE_SIZE}
                  totalItems={data.totalItems}
                  totalText={qtdLancamentos(data.totalItems)}
                  busy={isPlaceholderData}
                  onChange={handlePage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {dialogo && (
        <LancamentoFormDialog
          obraId={obraId}
          lancamento={lancamentoEmEdicao}
          onClose={handleCloseDialog}
          onSaved={handleSaved}
        />
      )}
    </PageSection>
  );
};
