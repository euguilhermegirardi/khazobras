import { apiRequest } from '@/shared/lib/apiClient'
import type { Obra, Paged } from './types'

/** Cliente recebe so as obras vinculadas a ele; admin/master recebem todas (paginado). */
export function listObras(signal?: AbortSignal): Promise<Paged<Obra>> {
  return apiRequest<Paged<Obra>>('/obras?pageIndex=0&pageSize=50', { signal })
}
