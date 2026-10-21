import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiDownload } from '@/services/apiClient';

interface UrlEntry {
  url: string;
  refs: number;
}

const entries = new WeakMap<Blob, UrlEntry>();
const GRACE_MS = 5000;

function revokeIfUnused(blob: Blob) {
  const entry = entries.get(blob);
  if (entry && entry.refs === 0) {
    URL.revokeObjectURL(entry.url);
    entries.delete(blob);
  }
}

/** URL estável por blob; criado na renderização (idempotente). Se nenhum componente o adotar, é revogado. */
function getUrl(blob: Blob): string {
  let entry = entries.get(blob);
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), refs: 0 };
    entries.set(blob, entry);
    setTimeout(() => revokeIfUnused(blob), GRACE_MS);
  }
  return entry.url;
}

/** Adota o URL do blob; devolve o release. A revogação é adiada para o remount do StrictMode readotar. */
function acquire(blob: Blob): () => void {
  getUrl(blob);
  const entry = entries.get(blob);
  if (entry) entry.refs += 1;
  return () => {
    const current = entries.get(blob);
    if (!current) return;
    current.refs -= 1;
    if (current.refs === 0) setTimeout(() => revokeIfUnused(blob), 0);
  };
}

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

  // O object URL vem de um cache por blob (sem setState em efeito: com dezenas de imagens resolvendo juntas, o ciclo
  // efeito -> setState -> render estourava "Maximum update depth"). O efeito só conta referências.
  const url = blob ? getUrl(blob) : null;

  // Effects (conta referência; revoga só quando ninguém mais usa, resistente ao ciclo duplo do StrictMode)
  useEffect(() => {
    if (!blob) return;
    return acquire(blob);
  }, [blob]);

  return { url, isLoading: Boolean(path) && isPending, isError };
};
