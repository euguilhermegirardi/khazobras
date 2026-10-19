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
