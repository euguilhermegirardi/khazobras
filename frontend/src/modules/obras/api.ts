import { apiRequest } from '@/services/apiClient'
import type { Obra } from '@/interfaces/obra'
import type { Paged } from '@/interfaces/paged'

/** Cliente recebe só as obras vinculadas a ele; admin/master recebem todas (paginado). */
export const listObras = (signal?: AbortSignal): Promise<Paged<Obra>> =>
  apiRequest<Paged<Obra>>('/obras?pageIndex=0&pageSize=50', { signal })
