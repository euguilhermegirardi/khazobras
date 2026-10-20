import { apiRequest } from '@/services/apiClient';
import type { DashboardResponse } from '@/interfaces/dashboard';

export const getDashboard = (obraId: string, signal?: AbortSignal): Promise<DashboardResponse> =>
  apiRequest<DashboardResponse>(`/obras/${obraId}/dashboard`, { signal });
