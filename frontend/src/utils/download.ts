/**
 * Salva um Blob já baixado pela API autenticada: link temporário com `download` e object URL revogado.
 * Nunca recebe URL de bucket (regra de segurança 5 do front).
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoga depois do clique ser processado, para o navegador iniciar o download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Tempo até revogar o object URL da aba aberta: o navegador já carregou o arquivo (PDF/imagem) nesse prazo. */
export const OPEN_BLOB_REVOKE_MS = 60_000

/**
 * Abre um Blob já baixado pela API autenticada numa nova aba (object URL, `noopener`), para visualizar PDF/imagem.
 * O object URL é revogado depois de `OPEN_BLOB_REVOKE_MS`. Nunca recebe URL de bucket.
 */
export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), OPEN_BLOB_REVOKE_MS)
}
