import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateContratoRequest, CreatePagamentoRequest } from '@/interfaces/contrato';
import { createContrato, createPagamento, getContratoAdmin, listContratosAdmin, listMedicoesComNf } from './api';

const adminKey = (obraId: string) => ['obra', obraId, 'contratos-admin'] as const;

export const useContratosAdmin = (obraId: string) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'lista'] as const,
    queryFn: ({ signal }) => listContratosAdmin(obraId, signal),
  });

export const useContratoAdminDetalhe = (obraId: string, contratoId: string) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'detalhe', contratoId] as const,
    queryFn: ({ signal }) => getContratoAdmin(contratoId, signal),
  });

/** Medições com NF emitida (seletor do pagamento). Só consulta enquanto o diálogo está aberto. */
export const useMedicoesComNf = (obraId: string) =>
  useQuery({
    queryKey: [...adminKey(obraId), 'medicoes-com-nf'] as const,
    queryFn: ({ signal }) => listMedicoesComNf(obraId, signal),
    select: (pagina) => pagina.items,
  });

/** Listas e detalhes do admin + os do cliente (tela Contratos) da mesma obra. */
const invalidateContratos = (queryClient: QueryClient, obraId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKey(obraId) }),
    queryClient.invalidateQueries({ queryKey: ['obra', obraId, 'contratos'] }),
  ]);

export const useCriarContrato = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContratoRequest) => createContrato(body),
    onSuccess: () => invalidateContratos(queryClient, obraId),
  });
};

export const useRegistrarPagamento = (obraId: string, contratoId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePagamentoRequest) => createPagamento(contratoId, body),
    onSuccess: () => invalidateContratos(queryClient, obraId),
  });
};
