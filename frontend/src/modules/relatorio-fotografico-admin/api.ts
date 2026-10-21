import type {
  CreateRelatorioFotograficoRequest,
  Foto,
  FotoOrdemItem,
  RelatorioFotografico,
  RelatorioFotograficoRequest,
  UpdateFotoRequest,
} from '@/interfaces/relatorioFotografico';
import { apiRequest, apiUpload } from '@/services/apiClient';

/** Detalhe com as fotos (200, 403, 404). A lista da obra vem de `hooks/useRelatoriosFotograficos` (base). */
export const getRelatorio = (id: string, signal?: AbortSignal): Promise<RelatorioFotografico> =>
  apiRequest<RelatorioFotografico>(`/relatorios-fotograficos/${id}`, { signal });

/** 201 com o relatório (sem fotos). 400 `{ errors }` (inclui `EtapaId`), 403, 404 (obra inexistente). */
export const createRelatorio = (body: CreateRelatorioFotograficoRequest): Promise<RelatorioFotografico> =>
  apiRequest<RelatorioFotografico>('/relatorios-fotograficos', { method: 'POST', body: { ...body } });

/** 200 com o relatório e as fotos. Manda os quatro campos; a obra nunca troca. 400, 403, 404. */
export const updateRelatorio = (id: string, body: RelatorioFotograficoRequest): Promise<RelatorioFotografico> =>
  apiRequest<RelatorioFotografico>(`/relatorios-fotograficos/${id}`, { method: 'PUT', body: { ...body } });

/** 204. Exclusão definitiva: as fotos saem junto. */
export const deleteRelatorio = (id: string): Promise<void> =>
  apiRequest<void>(`/relatorios-fotograficos/${id}`, { method: 'DELETE' });

export interface UploadFotoMetadados {
  /** "yyyy-MM-dd" ou vazio. */
  dataFoto?: string;
  descricao?: string;
}

/**
 * 201 com a foto. `dataFoto` e `descricao` vão na QUERY STRING (o multipart só leva o campo `file`). Sem `ordem`, a
 * foto vai para o fim. 400 `{ message }` (tipo, tamanho, nome, limite de 100), 403, 404.
 */
export const uploadFoto = (
  relatorioId: string,
  file: File,
  { dataFoto, descricao }: UploadFotoMetadados,
  signal?: AbortSignal,
): Promise<Foto> => {
  const params = new URLSearchParams();
  if (dataFoto) params.set('dataFoto', dataFoto);
  if (descricao) params.set('descricao', descricao);
  const texto = params.toString();
  const query = texto === '' ? '' : `?${texto}`;
  const form = new FormData();
  form.append('file', file);
  return apiUpload<Foto>(`/relatorios-fotograficos/${relatorioId}/fotos${query}`, form, signal);
};

/** 200 com a foto. Parcial: só o que estiver no corpo muda; `descricao`/`dataFoto` aceitam null. */
export const updateFoto = (fotoId: string, body: UpdateFotoRequest): Promise<Foto> =>
  apiRequest<Foto>(`/fotos/${fotoId}`, { method: 'PATCH', body: { ...body } });

/** 204. */
export const deleteFoto = (fotoId: string): Promise<void> => apiRequest<void>(`/fotos/${fotoId}`, { method: 'DELETE' });

/** Tudo-ou-nada (máx. 200). 200 com todas as fotos do relatório na nova ordem; 400 `errors.Fotos`. */
export const reordenarFotos = (relatorioId: string, fotos: FotoOrdemItem[]): Promise<Foto[]> =>
  apiRequest<Foto[]>(`/relatorios-fotograficos/${relatorioId}/fotos/ordem`, {
    method: 'PATCH',
    body: { fotos: fotos.map((f) => ({ ...f })) },
  });
