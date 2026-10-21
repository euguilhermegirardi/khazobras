import type { LancamentoAnexo } from '@/interfaces/financeiro';
import type {
  CategoriaOpcao,
  CreateLancamentoRequest,
  FinanceiroResumo,
  LancamentoAdmin,
  LancamentosFiltros,
  UpdateLancamentoRequest,
  VisibilidadeLoteResponse,
} from '@/interfaces/financeiroAdmin';
import type { Paged } from '@/interfaces/paged';
import { apiDownload, apiRequest, apiUpload } from '@/services/apiClient';
import { COMPETENCIA_FILTRO } from './constants';

interface ListParams {
  pageIndex: number;
  pageSize: number;
  filtros: LancamentosFiltros;
}

/** Todos os lançamentos da obra (liberados ou não), mais novos primeiro. Filtros opcionais só do admin. */
export const listLancamentosAdmin = (
  obraId: string,
  { pageIndex, pageSize, filtros }: ListParams,
  signal?: AbortSignal,
): Promise<Paged<LancamentoAdmin>> => {
  const params = new URLSearchParams({ pageIndex: String(pageIndex), pageSize: String(pageSize) });
  if (filtros.visivelCliente) params.set('visivelCliente', filtros.visivelCliente);
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  // Competência incompleta (navegador sem input de mês) não vai ao servidor: seria 400.
  if (COMPETENCIA_FILTRO.test(filtros.competencia)) params.set('competencia', filtros.competencia);
  return apiRequest<Paged<LancamentoAdmin>>(`/obras/${obraId}/financeiro/lancamentos?${params.toString()}`, { signal });
};

/** Totais da obra (custo real: só Admin/Master; cliente = 403). */
export const getResumo = (obraId: string, signal?: AbortSignal): Promise<FinanceiroResumo> =>
  apiRequest<FinanceiroResumo>(`/obras/${obraId}/financeiro/resumo`, { signal });

export const listCategorias = (signal?: AbortSignal): Promise<CategoriaOpcao[]> =>
  apiRequest<CategoriaOpcao[]>('/financeiro/categorias', { signal });

/** 201 com o lançamento. 400 `{ errors }`, 403, 404 (obra inexistente). */
export const createLancamento = (body: CreateLancamentoRequest): Promise<LancamentoAdmin> =>
  apiRequest<LancamentoAdmin>('/financeiro/lancamentos', { method: 'POST', body: { ...body } });

/** 200 com o lançamento atualizado. 400 `{ errors }`, 403, 404. */
export const updateLancamento = (id: string, body: UpdateLancamentoRequest): Promise<LancamentoAdmin> =>
  apiRequest<LancamentoAdmin>(`/financeiro/lancamentos/${id}`, { method: 'PUT', body: { ...body } });

/** 204. Exclusão definitiva (os comprovantes saem junto). */
export const deleteLancamento = (id: string): Promise<void> =>
  apiRequest<void>(`/financeiro/lancamentos/${id}`, { method: 'DELETE' });

export const setVisibilidade = (id: string, visivelCliente: boolean): Promise<LancamentoAdmin> =>
  apiRequest<LancamentoAdmin>(`/financeiro/lancamentos/${id}/visibilidade`, {
    method: 'PATCH',
    body: { visivelCliente },
  });

/** Tudo-ou-nada: um id fora da obra = 400 `errors.Ids` sem alterar nenhum. */
export const setVisibilidadeLote = (
  obraId: string,
  ids: string[],
  visivelCliente: boolean,
): Promise<VisibilidadeLoteResponse> =>
  apiRequest<VisibilidadeLoteResponse>(`/obras/${obraId}/financeiro/lancamentos/visibilidade`, {
    method: 'PATCH',
    body: { ids, visivelCliente },
  });

/** 201 com o anexo. 400 `{ message }` (tipo, tamanho, limite de 10), 403, 404. */
export const uploadAnexo = (lancamentoId: string, file: File): Promise<LancamentoAnexo> => {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<LancamentoAnexo>(`/financeiro/lancamentos/${lancamentoId}/anexos`, form);
};

/** 204. */
export const deleteAnexo = (anexoId: string): Promise<void> =>
  apiRequest<void>(`/financeiro/anexos/${anexoId}`, { method: 'DELETE' });

/** Baixa o comprovante pela API (Bearer -> blob). O nome do Content-Disposition tem prioridade. */
export const downloadAnexo = async (anexo: LancamentoAnexo): Promise<{ blob: Blob; fileName: string }> => {
  const { blob, fileName } = await apiDownload(`/financeiro/anexos/${anexo.id}/download`);
  return { blob, fileName: fileName ?? anexo.nomeArquivo };
};
