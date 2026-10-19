import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EtapaCreateRequest, EtapaUpdateRequest } from '@/interfaces/etapa';
import { createEtapa, listEtapas, updateEtapa } from './api';

export type SalvarEtapaInput =
  { mode: 'create'; body: EtapaCreateRequest } | { mode: 'edit'; id: string; body: EtapaUpdateRequest };

export const useEtapasGantt = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'gantt'] as const,
    queryFn: ({ signal }) => listEtapas(obraId, signal),
  });

/**
 * Cria ou atualiza uma etapa. Ao salvar, invalida o Gantt e também o que o cliente enxerga da mesma obra:
 * Cronograma (`'cronograma'`) e a lista de nomes de etapas (`'etapas'`: Projetos e Relatório fotográfico).
 */
export const useSalvarEtapa = (obraId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SalvarEtapaInput) =>
      input.mode === 'create' ? createEtapa(input.body) : updateEtapa(input.id, input.body),
    onSuccess: () =>
      Promise.all(
        ['gantt', 'cronograma', 'etapas'].map((chave) =>
          queryClient.invalidateQueries({ queryKey: ['obra', obraId, chave] }),
        ),
      ),
  });
};
