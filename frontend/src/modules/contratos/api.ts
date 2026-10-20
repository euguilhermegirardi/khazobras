import type { ContratoCliente, ContratoDetalheCliente } from '@/interfaces/contrato';
import { apiRequest } from '@/services/apiClient';

/** Array puro (sem paginação), mais antigo primeiro. O cliente recebe o DTO reduzido. */
export const listContratos = (obraId: string, signal?: AbortSignal): Promise<ContratoCliente[]> =>
  apiRequest<ContratoCliente[]>(`/obras/${obraId}/contratos`, { signal });

/** Contrato + pagamentos (data mais recente primeiro). */
export const getContrato = (contratoId: string, signal?: AbortSignal): Promise<ContratoDetalheCliente> =>
  apiRequest<ContratoDetalheCliente>(`/contratos/${contratoId}`, { signal });
