import type { ProjetoDocumento, ProjetoRequest } from '@/interfaces/projeto';
import { apiRequest, apiUpload } from '@/services/apiClient';

/** A lista da obra e o download vêm de `hooks/useProjetos` (base, dividida com o cliente). */

export interface UploadProjetoMetadados {
  /** Id da etapa da mesma obra; vazio = sem etapa. */
  etapaId?: string;
  /** Até 50 caracteres; vazio = sem tipo. */
  tipoDocumento?: string;
}

/**
 * 201 com o documento. `etapaId` e `tipoDocumento` vão na QUERY STRING (o multipart só leva o campo `file`), com
 * `encodeURIComponent`. 400 `{ message }` (tipo, tamanho, nome, tipo longo, 201º documento) ou `errors.EtapaId`, 403, 404.
 */
export const uploadProjeto = (
  obraId: string,
  file: File,
  { etapaId, tipoDocumento }: UploadProjetoMetadados,
  signal?: AbortSignal,
): Promise<ProjetoDocumento> => {
  const partes: string[] = [];
  if (etapaId) partes.push(`etapaId=${encodeURIComponent(etapaId)}`);
  if (tipoDocumento) partes.push(`tipoDocumento=${encodeURIComponent(tipoDocumento)}`);
  const query = partes.length === 0 ? '' : `?${partes.join('&')}`;
  const form = new FormData();
  form.append('file', file);
  return apiUpload<ProjetoDocumento>(`/obras/${obraId}/projetos${query}`, form, signal);
};

/** 200 com o documento. Substitui os três campos (`null` limpa tipo e etapa). 400 `errors.Nome`/`EtapaId`, 403, 404. */
export const updateProjeto = (id: string, body: ProjetoRequest): Promise<ProjetoDocumento> =>
  apiRequest<ProjetoDocumento>(`/projetos/${id}`, { method: 'PUT', body: { ...body } });

/** 204. Exclusão definitiva: sem lixeira, o arquivo sai do armazenamento. */
export const deleteProjeto = (id: string): Promise<void> => apiRequest<void>(`/projetos/${id}`, { method: 'DELETE' });
