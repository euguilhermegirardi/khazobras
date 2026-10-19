import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveMedicao, getMedicao, listMedicoes } from './api';

const medicoesKey = (obraId: string) => ['obra', obraId, 'medicoes'] as const;

export const useMedicoes = (obraId: string) =>
  useQuery({
    queryKey: medicoesKey(obraId),
    queryFn: ({ signal }) => listMedicoes(obraId, signal),
  });

export const useMedicao = (obraId: string, medicaoId: string) =>
  useQuery({
    queryKey: [...medicoesKey(obraId), medicaoId],
    queryFn: ({ signal }) => getMedicao(medicaoId, signal),
  });

export const useApproveMedicao = (obraId: string, medicaoId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => approveMedicao(medicaoId),
    // Mesmo no 409 (já aprovada por outro lado) o estado real do servidor precisa voltar para a tela.
    onSettled: () => queryClient.invalidateQueries({ queryKey: medicoesKey(obraId) }),
  });
};
