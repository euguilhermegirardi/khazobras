import { useQuery } from '@tanstack/react-query'
import { listEtapasCronograma } from './api'

export const useCronograma = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'cronograma'] as const,
    queryFn: ({ signal }) => listEtapasCronograma(obraId, signal),
  })
