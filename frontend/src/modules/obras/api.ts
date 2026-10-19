import { apiRequest } from '@/services/apiClient';
import type { Obra } from '@/interfaces/obra';
import type { Paged } from '@/interfaces/paged';

/** Cliente recebe só as obras vinculadas a ele; admin/master recebem todas (paginado, `pageIndex` base 0). */
export const listObras = (pageIndex: number, pageSize: number, signal?: AbortSignal): Promise<Paged<Obra>> =>
  apiRequest<Paged<Obra>>(`/obras?pageIndex=${pageIndex}&pageSize=${pageSize}`, { signal });
