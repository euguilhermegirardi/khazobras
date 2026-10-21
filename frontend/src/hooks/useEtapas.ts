import { useQuery } from '@tanstack/react-query';
import type { Etapa } from '@/interfaces/etapa';
import { apiRequest } from '@/services/apiClient';

/**
 * Etapas da obra só para traduzir `etapaId` em nome (Relatório fotográfico, Projetos).
 * Falhar aqui não deve derrubar a tela: quem usa segue com um título genérico.
 * `retryOnMount: false`: um componente novo (ex.: diálogo de edição) montado sobre a query em erro não a refaz, senão o
 * status voltaria a `pending` e telas que mostram skeleton enquanto `isPending` entrariam em loop de montar/desmontar.
 */
export const useEtapas = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'etapas'] as const,
    queryFn: ({ signal }) => apiRequest<Etapa[]>(`/obras/${obraId}/etapas`, { signal }),
    retryOnMount: false,
  });
