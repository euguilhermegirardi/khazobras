import { useQuery } from '@tanstack/react-query';
import type { RelatorioMensal } from '@/interfaces/relatorioMensal';
import { apiRequest } from '@/services/apiClient';

/**
 * Prefixo de cache dos relatórios mensais da obra. A lista do cliente usa exatamente esta chave; as leituras do admin
 * ficam abaixo dela (`[...chave, 'admin', ...]`), então invalidar este prefixo atualiza a visão do cliente e as do admin.
 */
export const relatoriosMensaisKey = (obraId: string) => ['obra', obraId, 'relatorios-mensais'] as const;

/** Só os publicados (o cliente nunca vê rascunho). O backend não pagina; devolve array puro. */
export const useRelatoriosMensais = (obraId: string) =>
  useQuery({
    queryKey: relatoriosMensaisKey(obraId),
    queryFn: ({ signal }) =>
      apiRequest<RelatorioMensal[]>(`/obras/${obraId}/relatorios-mensais?onlyPublished=true`, { signal }),
  });
