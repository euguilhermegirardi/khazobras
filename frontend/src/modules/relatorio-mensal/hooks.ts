import { useQuery } from '@tanstack/react-query';
import { listRelatoriosMensais } from './api';

export const useRelatoriosMensais = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'relatorios-mensais'] as const,
    queryFn: ({ signal }) => listRelatoriosMensais(obraId, signal),
  });
