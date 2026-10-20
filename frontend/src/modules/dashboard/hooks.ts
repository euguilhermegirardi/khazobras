import { useQuery } from '@tanstack/react-query';
import { getDashboard } from './api';

/** Chave `['obra', id, 'dashboard']`: quem muda medição/etapa/pagamento pode invalidar por esse prefixo. */
export const useDashboard = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'dashboard'] as const,
    queryFn: ({ signal }) => getDashboard(obraId, signal),
  });
