import { useQuery } from '@tanstack/react-query';
import { listRelatoriosFotograficos } from './api';

export const useRelatoriosFotograficos = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'relatorios-fotograficos'] as const,
    queryFn: ({ signal }) => listRelatoriosFotograficos(obraId, signal),
  });
