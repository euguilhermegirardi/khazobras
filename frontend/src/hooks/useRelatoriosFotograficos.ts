import { useQuery } from '@tanstack/react-query';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { apiRequest } from '@/services/apiClient';

/** Prefixo de cache de tudo que é do relatório fotográfico da obra (lista do cliente e do admin, detalhe). */
export const relatoriosFotograficosKey = (obraId: string) => ['obra', obraId, 'relatorios-fotograficos'] as const;

/**
 * Relatórios fotográficos da obra (array puro, mais novo primeiro; o backend não pagina). Cliente e admin leem o
 * mesmo endpoint e o mesmo DTO, então dividem a chave: escrever do admin atualiza a tela do cliente.
 */
export const useRelatoriosFotograficos = (obraId: string) =>
  useQuery({
    queryKey: relatoriosFotograficosKey(obraId),
    queryFn: ({ signal }) => apiRequest<RelatorioFotografico[]>(`/obras/${obraId}/relatorios-fotograficos`, { signal }),
  });
