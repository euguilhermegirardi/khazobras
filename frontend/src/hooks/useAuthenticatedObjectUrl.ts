import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { apiDownload } from '@/services/apiClient';

/**
 * Baixa um arquivo pela API autenticada (Bearer) e devolve um object URL para `<img src>`/links.
 * `<img src>` não envia Authorization, por isso o fetch -> blob. O URL é revogado ao desmontar.
 * `path` null/undefined não busca nada (útil para carregar só quando visível ou aberto).
 */
export const useAuthenticatedObjectUrl = (path: string | null | undefined) => {
  // Hooks
  const {
    data: blob,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['arquivo', path] as const,
    queryFn: async ({ signal }) => (await apiDownload(path ?? '', signal)).blob,
    enabled: Boolean(path),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // O object URL é derivado do blob (sem setState em efeito: com dezenas de imagens resolvendo juntas, o ciclo
  // efeito -> setState -> render somava-se às notificações do TanStack Query e estourava "Maximum update depth").
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  // Effects (revoga o URL ao trocar o blob ou desmontar)
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return { url, isLoading: Boolean(path) && isPending, isError };
};
