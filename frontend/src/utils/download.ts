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

/** Únicos tipos que abrem no navegador (defesa em profundidade: SVG/HTML rodariam script na origem do app). */
const VIEWABLE_TYPE = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/i

/**
 * Abre um Blob já baixado pela API autenticada numa nova aba (object URL, `noopener`), para visualizar PDF/imagem.
 * Só `application/pdf` e `image/(jpeg|png|webp|gif)` (pelo `blob.type`) abrem; qualquer outro tipo
 * (inclusive vazio, `text/html`, `image/svg+xml`) é baixado com `saveBlob`.
 * O object URL é revogado depois de `OPEN_BLOB_REVOKE_MS`. Nunca recebe URL de bucket.
 */
export function openBlobInNewTab(blob: Blob, fileName = 'arquivo'): void {
  if (!VIEWABLE_TYPE.test(blob.type)) {
    saveBlob(blob, fileName)
    return
  }
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), OPEN_BLOB_REVOKE_MS)
}
