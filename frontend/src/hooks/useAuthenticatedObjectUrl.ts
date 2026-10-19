import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiDownload } from '@/services/apiClient';

/**
 * Baixa um arquivo pela API autenticada (Bearer) e devolve um object URL para `<img src>`/links.
 * `<img src>` não envia Authorization, por isso o fetch -> blob. O URL é revogado ao desmontar.
 * `path` null/undefined não busca nada (útil para carregar só quando visível ou aberto).
 */
export const useAuthenticatedObjectUrl = (path: string | null | undefined) => {
  // Estados
  const [url, setUrl] = useState<string | null>(null);

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

  // Effects (object URL é recurso do navegador, não dado do servidor)
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    // oxlint-disable-next-line react/set-state-in-effect -- o object URL é um recurso externo do navegador, criado e revogado aqui
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [blob]);

  return { url, isLoading: Boolean(path) && (isPending || (Boolean(blob) && !url)), isError };
};
