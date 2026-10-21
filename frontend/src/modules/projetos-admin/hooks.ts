import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { projetosKey } from '@/hooks/useProjetos';
import type { ProjetoRequest } from '@/interfaces/projeto';
import { deleteProjeto, updateProjeto } from './api';

/** Relê a lista de documentos da obra (a mesma chave do Projetos do cliente). */
export const invalidateProjetos = (queryClient: QueryClient, obraId: string) =>
  queryClient.invalidateQueries({ queryKey: projetosKey(obraId) });

export const useEditarProjeto = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProjetoRequest }) => updateProjeto(id, body),
    onSuccess: () => invalidateProjetos(queryClient, obraId),
  });
};

/** Mesmo se falhar (ex.: já excluído em outra aba) a lista precisa refletir o servidor. */
export const useExcluirProjeto = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjeto(id),
    onSettled: () => invalidateProjetos(queryClient, obraId),
  });
};
