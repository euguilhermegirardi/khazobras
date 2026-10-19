import type { LancamentoAnexo, LancamentoCliente } from '@/interfaces/financeiro';
import type { Paged } from '@/interfaces/paged';
import { apiDownload, apiRequest } from '@/services/apiClient';

/** Lançamentos liberados ao cliente (o filtro é do backend), mais novos primeiro. Paginado no servidor. */
export const listLancamentos = (
  obraId: string,
  pageIndex: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Paged<LancamentoCliente>> =>
  apiRequest<Paged<LancamentoCliente>>(
    `/obras/${obraId}/financeiro/lancamentos?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    { signal },
  );

/** Baixa o comprovante pela API (Bearer -> blob). O nome do Content-Disposition tem prioridade. */
export const downloadComprovante = async (anexo: LancamentoAnexo): Promise<{ blob: Blob; fileName: string }> => {
  const { blob, fileName } = await apiDownload(`/financeiro/anexos/${anexo.id}/download`);
  return { blob, fileName: fileName ?? anexo.nomeArquivo };
};
