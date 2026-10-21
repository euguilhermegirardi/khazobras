import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { relatoriosMensaisKey } from '@/hooks/useRelatoriosMensais';
import type {
  CreateRelatorioMensalRequest,
  RelatorioMensalAdmin,
  RelatorioMensalRequest,
} from '@/interfaces/relatorioMensal';
import {
  createRelatorio,
  deleteRelatorio,
  getHistorico,
  getRelatorio,
  listRelatorios,
  publishRelatorio,
  updateRelatorio,
} from './api';

// Tudo do admin fica abaixo do prefixo do cliente (`['obra', id, 'relatorios-mensais']`): invalidar o prefixo atualiza
// a lista do cliente e as leituras do admin de uma vez.
const adminKey = (obraId: string) => [...relatoriosMensaisKey(obraId), 'admin'] as const;
const listaKey = (obraId: string) => [...adminKey(obraId), 'lista'] as const;
const detalheKey = (obraId: string, relatorioId: string) => [...adminKey(obraId), 'detalhe', relatorioId] as const;
const historicoKey = (obraId: string, relatorioId: string) => [...adminKey(obraId), 'historico', relatorioId] as const;

/** Rascunhos e publicados da obra (a lista do cliente tem a própria chave, só com os publicados). */
export const useRelatoriosAdmin = (obraId: string) =>
  useQuery({
    queryKey: listaKey(obraId),
    queryFn: ({ signal }) => listRelatorios(obraId, signal),
  });

export const useRelatorioAdmin = (obraId: string, relatorioId: string) =>
  useQuery({
    queryKey: detalheKey(obraId, relatorioId),
    queryFn: ({ signal }) => getRelatorio(relatorioId, signal),
  });

/** Histórico de alterações (até 100). Query secundária da página: o erro dela não derruba o relatório. */
export const useHistoricoRelatorio = (obraId: string, relatorioId: string) =>
  useQuery({
    queryKey: historicoKey(obraId, relatorioId),
    queryFn: ({ signal }) => getHistorico(relatorioId, signal),
  });

/** Lista do admin, detalhes, históricos e a lista do cliente da obra. */
export const invalidateRelatorios = (queryClient: QueryClient, obraId: string) =>
  queryClient.invalidateQueries({ queryKey: relatoriosMensaisKey(obraId) });

export const useCriarRelatorio = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRelatorioMensalRequest) => createRelatorio(body),
    onSuccess: () => invalidateRelatorios(queryClient, obraId),
  });
};

export const useEditarRelatorio = (obraId: string, relatorioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RelatorioMensalRequest) => updateRelatorio(relatorioId, body),
    onSuccess: (salvo) => {
      // O formulário reabre com o texto salvo mesmo antes da releitura terminar.
      queryClient.setQueryData<RelatorioMensalAdmin>(detalheKey(obraId, relatorioId), salvo);
      return invalidateRelatorios(queryClient, obraId);
    },
  });
};

/** Publica e atualiza também a visão do cliente (mesmo prefixo de cache). Mesmo em erro (409) relê o servidor. */
export const usePublicarRelatorio = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishRelatorio(id),
    onSettled: () => invalidateRelatorios(queryClient, obraId),
  });
};

/** Tira do cache o detalhe e o histórico de um relatório apagado (chamar depois que a página saiu da tela). */
export const removerRelatorioDoCache = (queryClient: QueryClient, obraId: string, relatorioId: string) => {
  queryClient.removeQueries({ queryKey: detalheKey(obraId, relatorioId) });
  queryClient.removeQueries({ queryKey: historicoKey(obraId, relatorioId) });
};

/**
 * `esperarLeitura = false` (página do próprio relatório): no sucesso NÃO relê o detalhe nem o histórico do relatório
 * apagado (voltariam 404 e a tela piscaria o erro antes de navegar); só a lista e o resto são invalidados. A página
 * navega e depois chama `removerRelatorioDoCache`. Em erro (ex.: 409, já publicado) tudo é relido de propósito.
 */
export const useExcluirRelatorio = (obraId: string, esperarLeitura = true) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRelatorio(id),
    onSettled: (_dados, erro, id) => {
      const leitura = queryClient.invalidateQueries({
        queryKey: relatoriosMensaisKey(obraId),
        // Chaves do detalhe e do histórico terminam no id do relatório: ['obra', obra, 'relatorios-mensais', 'admin', tipo, id].
        predicate: (query) => esperarLeitura || erro !== null || query.queryKey[5] !== id,
      });
      return esperarLeitura ? leitura : undefined;
    },
  });
};
