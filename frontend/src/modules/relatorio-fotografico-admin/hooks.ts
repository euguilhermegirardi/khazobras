import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { relatoriosFotograficosKey } from '@/hooks/useRelatoriosFotograficos';
import type {
  CreateRelatorioFotograficoRequest,
  Foto,
  FotoOrdemItem,
  RelatorioFotografico,
  RelatorioFotograficoRequest,
  UpdateFotoRequest,
} from '@/interfaces/relatorioFotografico';
import {
  createRelatorio,
  deleteFoto,
  deleteRelatorio,
  getRelatorio,
  reordenarFotos,
  updateFoto,
  updateRelatorio,
} from './api';

const detalheKey = (obraId: string, relatorioId: string) =>
  [...relatoriosFotograficosKey(obraId), 'detalhe', relatorioId] as const;

/** Detalhe com as fotos. Fica sob o prefixo da lista, então invalidar a lista invalida o detalhe. */
export const useRelatorio = (obraId: string, relatorioId: string) =>
  useQuery({
    queryKey: detalheKey(obraId, relatorioId),
    queryFn: ({ signal }) => getRelatorio(relatorioId, signal),
  });

/** Lista (a mesma chave do Relatório fotográfico do cliente) e detalhes da obra. */
export const invalidateRelatorios = (queryClient: QueryClient, obraId: string) =>
  queryClient.invalidateQueries({ queryKey: relatoriosFotograficosKey(obraId) });

export const useCriarRelatorio = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRelatorioFotograficoRequest) => createRelatorio(body),
    onSuccess: () => invalidateRelatorios(queryClient, obraId),
  });
};

export const useEditarRelatorio = (obraId: string, relatorioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RelatorioFotograficoRequest) => updateRelatorio(relatorioId, body),
    onSuccess: () => invalidateRelatorios(queryClient, obraId),
  });
};

/** Tira do cache o detalhe de um relatório apagado (chamar depois que a página saiu da tela). */
export const removerRelatorioDoCache = (queryClient: QueryClient, obraId: string, relatorioId: string) => {
  queryClient.removeQueries({ queryKey: detalheKey(obraId, relatorioId) });
};

/**
 * `esperarLeitura = false` (página do próprio relatório): no sucesso NÃO relê o detalhe do relatório apagado (voltaria
 * 404 e a tela piscaria o erro antes de navegar); só a lista e o resto são invalidados. A página navega e, ao
 * desmontar, chama `removerRelatorioDoCache` (remover com a página montada faria o observer buscar de novo).
 * Em erro tudo é relido de propósito.
 */
export const useExcluirRelatorio = (obraId: string, esperarLeitura = true) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRelatorio(id),
    // Mesmo se falhar (ex.: já excluído em outra aba) a lista precisa refletir o servidor.
    onSettled: (_dados, erro, id) => {
      const leitura = queryClient.invalidateQueries({
        queryKey: relatoriosFotograficosKey(obraId),
        // Chave do detalhe: ['obra', obra, 'relatorios-fotograficos', 'detalhe', id].
        predicate: (query) => esperarLeitura || erro !== null || query.queryKey[4] !== id,
      });
      return esperarLeitura ? leitura : undefined;
    },
  });
};

export const useEditarFoto = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fotoId, body }: { fotoId: string; body: UpdateFotoRequest }) => updateFoto(fotoId, body),
    onSuccess: () => invalidateRelatorios(queryClient, obraId),
  });
};

export const useRemoverFoto = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fotoId: string) => deleteFoto(fotoId),
    onSettled: () => invalidateRelatorios(queryClient, obraId),
  });
};

/**
 * Reordenar com atualização otimista: a tela já mostra a nova ordem no detalhe; se o servidor recusar (tudo-ou-nada),
 * volta ao que estava. Ao fim (sucesso ou erro) refaz a leitura para refletir o servidor.
 * `variables.fotosDepois` = todas as fotos na nova ordem; `lote` = só as que mudaram (o corpo do PATCH).
 */
export const useReordenarFotos = (obraId: string, relatorioId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lote }: { fotosDepois: Foto[]; lote: FotoOrdemItem[] }) => reordenarFotos(relatorioId, lote),
    onMutate: async ({ fotosDepois }) => {
      const key = detalheKey(obraId, relatorioId);
      await queryClient.cancelQueries({ queryKey: key });
      const anterior = queryClient.getQueryData<RelatorioFotografico>(key);
      if (anterior) queryClient.setQueryData<RelatorioFotografico>(key, { ...anterior, fotos: fotosDepois });
      return { anterior };
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(detalheKey(obraId, relatorioId), contexto.anterior);
    },
    onSettled: () => invalidateRelatorios(queryClient, obraId),
  });
};

/**
 * Object URL de um arquivo escolhido no computador (pré-visualização local, nunca enviado a lugar nenhum). Criado ao
 * montar e revogado ao desmontar (ou ao trocar o arquivo).
 */
export const useArquivoLocalUrl = (arquivo: File) => {
  // Estados
  const [url, setUrl] = useState<string | null>(null);

  // Effects (object URL é recurso do navegador, não dado do servidor)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(arquivo);
    // oxlint-disable-next-line react/set-state-in-effect -- o object URL é um recurso externo do navegador, criado e revogado aqui
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [arquivo]);

  return url;
};
