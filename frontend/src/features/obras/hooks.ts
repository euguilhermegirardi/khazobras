import { useQuery } from '@tanstack/react-query'
import { listObras } from './api'

export const useObras = () =>
  useQuery({
    queryKey: ['obras'],
    queryFn: ({ signal }) => listObras(signal),
  })
