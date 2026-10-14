import { useQuery } from '@tanstack/react-query'
import { listObras } from './api'

export function useObras() {
  return useQuery({
    queryKey: ['obras'],
    queryFn: ({ signal }) => listObras(signal),
  })
}
