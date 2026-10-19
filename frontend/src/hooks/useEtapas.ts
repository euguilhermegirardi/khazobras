import { useQuery } from '@tanstack/react-query'
import type { Etapa } from '@/interfaces/etapa'
import { apiRequest } from '@/services/apiClient'

/**
 * Etapas da obra só para traduzir `etapaId` em nome (Relatório fotográfico, Projetos).
 * Falhar aqui não deve derrubar a tela: quem usa segue com um título genérico.
 */
export const useEtapas = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'etapas'] as const,
    queryFn: ({ signal }) => apiRequest<Etapa[]>(`/obras/${obraId}/etapas`, { signal }),
  })
