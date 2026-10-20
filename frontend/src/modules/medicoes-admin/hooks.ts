import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMedicaoRequest, IssueInvoiceRequest, MedicaoStatusFiltro } from '@/interfaces/medicao';
import { createMedicao, getMedicaoAdmin, issueInvoice, listMedicoesResumo } from './api';
import { PAGE_SIZE } from './constants';

const adminKey = (obraId: string) => ['obra', obraId, 'medicoes-admin'] as const;

export const useMedicoesResumo = (obraId: string, pageIndex: number, status: MedicaoStatusFiltro | undefined) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'lista', status ?? 'todas', pageIndex, PAGE_SIZE] as const,
    queryFn: ({ signal }) => listMedicoesResumo(obraId, { pageIndex, pageSize: PAGE_SIZE, status }, signal),
    // Trocar de página/filtro mantém a lista anterior na tela até a nova chegar.
    placeholderData: keepPreviousData,
  });

/**
 * Total de medições (todas ou de um status): 1 consulta com `pageSize=1`, só para ler `totalItems`.
 * É o jeito honesto de contar sem baixar todas as páginas.
 */
export const useMedicoesTotal = (obraId: string, status?: MedicaoStatusFiltro) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'total', status ?? 'todas'] as const,
    queryFn: ({ signal }) => listMedicoesResumo(obraId, { pageIndex: 0, pageSize: 1, status }, signal),
    select: (pagina) => pagina.totalItems,
  });

export const useMedicaoAdmin = (obraId: string, medicaoId: string) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'detalhe', medicaoId] as const,
    queryFn: ({ signal }) => getMedicaoAdmin(medicaoId, signal),
  });

/** Lista, totais e detalhe do admin + a lista do cliente (Fechamento) da mesma obra. */
const invalidateMedicoes = (queryClient: QueryClient, obraId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKey(obraId) }),
    queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'medicoes'] }),
  ]);

export const useCriarMedicao = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMedicaoRequest) => createMedicao(body),
    onSuccess: () => invalidateMedicoes(queryClient, obraId),
  });
};

export const useEmitirNf = (obraId: string, medicaoId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IssueInvoiceRequest) => issueInvoice(medicaoId, body),
    // Mesmo no 409 (já mudou de status) o estado real do servidor precisa voltar para a tela.
    onSettled: () => invalidateMedicoes(queryClient, obraId),
  });
};
