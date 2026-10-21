import { useMutation, useQuery } from '@tanstack/react-query';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { apiDownload, apiRequest } from '@/services/apiClient';
import { openBlobInNewTab, saveBlob } from '@/utils/download';

/** Prefixo de cache dos documentos de projeto da obra (lista do cliente e do admin). */
export const projetosKey = (obraId: string) => ['obra', obraId, 'projetos'] as const;

/**
 * Documentos da obra (array puro, sem paginação, máx. 200): por etapa, sem etapa por último, depois o mais novo.
 * Cliente e admin leem o mesmo endpoint e o mesmo DTO, então dividem a chave: escrever do admin atualiza o cliente.
 */
export const useProjetos = (obraId: string) =>
  useQuery({
    queryKey: projetosKey(obraId),
    queryFn: ({ signal }) => apiRequest<ProjetoDocumento[]>(`/obras/${obraId}/projetos`, { signal }),
  });

export type ProjetoAcao = 'visualizar' | 'baixar';

export interface ProjetoAcaoVariables {
  projeto: ProjetoDocumento;
  acao: ProjetoAcao;
}

/**
 * Baixa o arquivo pela API autenticada (Bearer -> blob; o nome do Content-Disposition tem prioridade) e o salva ou abre
 * em nova aba (só PDF/imagem abrem; o resto baixa). `variables` diz qual item está em andamento.
 */
export const useAcaoProjeto = () =>
  useMutation({
    mutationFn: async ({ projeto, acao }: ProjetoAcaoVariables) => {
      const { blob, fileName } = await apiDownload(`/projetos/${projeto.id}/download`);
      const nome = fileName ?? projeto.nome;
      if (acao === 'visualizar') openBlobInNewTab(blob, nome);
      else saveBlob(blob, nome);
    },
  });
