import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LancamentoAnexo } from '@/interfaces/financeiro';
import type {
  CreateLancamentoRequest,
  LancamentosFiltros,
  UpdateLancamentoRequest,
} from '@/interfaces/financeiroAdmin';
import { saveBlob } from '@/utils/download';
import {
  createLancamento,
  deleteAnexo,
  deleteLancamento,
  downloadAnexo,
  getResumo,
  listCategorias,
  listLancamentosAdmin,
  setVisibilidade,
  setVisibilidadeLote,
  updateLancamento,
  uploadAnexo,
} from './api';
import { CATEGORIAS_PADRAO, PAGE_SIZE } from './constants';

const adminKey = (obraId: string) => ['obra', obraId, 'financeiro-admin'] as const;

export const useLancamentosAdmin = (obraId: string, pageIndex: number, filtros: LancamentosFiltros) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'lista', filtros, pageIndex, PAGE_SIZE] as const,
    queryFn: ({ signal }) => listLancamentosAdmin(obraId, { pageIndex, pageSize: PAGE_SIZE, filtros }, signal),
    // Trocar de página/filtro mantém a tabela anterior na tela até a nova chegar.
    placeholderData: keepPreviousData,
  });

/** Totais da obra inteira (não só da página). Falhar não derruba a tela: os KPIs mostram "—". */
export const useResumo = (obraId: string) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'resumo'] as const,
    queryFn: ({ signal }) => getResumo(obraId, signal),
  });

/** Opções do select de categoria. Se o endpoint falhar, usa as três do enum (os valores não mudam). */
export const useCategoriaOpcoes = () => {
  const consulta = useQuery({
    queryKey: ['financeiro', 'categorias'] as const,
    queryFn: ({ signal }) => listCategorias(signal),
    staleTime: Infinity,
  });
  return consulta.data && consulta.data.length > 0 ? consulta.data : CATEGORIAS_PADRAO;
};

/** Lista e resumo do admin + a lista do cliente (Financeiro cliente) da mesma obra. */
const invalidateFinanceiro = (queryClient: QueryClient, obraId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKey(obraId) }),
    queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'financeiro'] }),
  ]);

export const useCriarLancamento = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLancamentoRequest) => createLancamento(body),
    onSuccess: () => invalidateFinanceiro(queryClient, obraId),
  });
};

export const useEditarLancamento = (obraId: string, id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateLancamentoRequest) => updateLancamento(id, body),
    onSuccess: () => invalidateFinanceiro(queryClient, obraId),
  });
};

export const useExcluirLancamento = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLancamento(id),
    // Mesmo se falhar (ex.: já excluído em outra aba) a lista precisa refletir o servidor.
    onSettled: () => invalidateFinanceiro(queryClient, obraId),
  });
};

/** Um lançamento por vez; `variables.id` diz qual linha está gravando. */
export const useAlterarVisibilidade = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, visivelCliente }: { id: string; visivelCliente: boolean }) =>
      setVisibilidade(id, visivelCliente),
    onSettled: () => invalidateFinanceiro(queryClient, obraId),
  });
};

export const useAlterarVisibilidadeLote = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, visivelCliente }: { ids: string[]; visivelCliente: boolean }) =>
      setVisibilidadeLote(obraId, ids, visivelCliente),
    onSettled: () => invalidateFinanceiro(queryClient, obraId),
  });
};

export const useEnviarAnexo = (obraId: string, lancamentoId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAnexo(lancamentoId, file),
    onSuccess: () => invalidateFinanceiro(queryClient, obraId),
  });
};

export const useRemoverAnexo = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (anexoId: string) => deleteAnexo(anexoId),
    onSettled: () => invalidateFinanceiro(queryClient, obraId),
  });
};

/** Baixa e salva o comprovante. Só um por vez; `variables` diz qual está em andamento. */
export const useBaixarAnexo = () =>
  useMutation({
    mutationFn: async (anexo: LancamentoAnexo) => {
      const { blob, fileName } = await downloadAnexo(anexo);
      saveBlob(blob, fileName);
    },
  });
