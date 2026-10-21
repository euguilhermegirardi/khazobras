/**
 * Regras de upload de comprovante, espelhando `FileUploadValidator` do backend (que continua sendo a fonte:
 * ele ainda confere MIME e magic bytes). Aqui só o que dá para recusar antes de enviar: vazio, tamanho e extensão.
 */
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024;
export const ANEXO_MAX_POR_LANCAMENTO = 10;

/** Extensão (minúscula, com ponto) -> MIME que o backend exige para ela. */
const MIME_POR_EXTENSAO: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};

/** Valor para o atributo `accept` do `<input type="file">`. */
export const ANEXO_ACCEPT = Object.keys(MIME_POR_EXTENSAO).join(',');

/** Extensões em texto para mensagens ("JPG, PNG, ..."). */
export const ANEXO_EXTENSOES_TEXTO = Object.keys(MIME_POR_EXTENSAO)
  .map((e) => e.slice(1).toUpperCase())
  .join(', ');

function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto < 0 ? '' : nome.slice(ponto).toLowerCase();
}

/** Mensagem de erro (em português) ou null se o arquivo pode ser enviado. */
export function validarAnexo(arquivo: { name: string; size: number }): string | null {
  if (arquivo.size <= 0) return 'O arquivo está vazio.';
  if (arquivo.size > ANEXO_MAX_BYTES) return 'O arquivo excede o tamanho máximo de 10 MB.';
  if (arquivo.name.trim() === '') return 'O arquivo não tem nome.';
  if (!(extensaoDe(arquivo.name) in MIME_POR_EXTENSAO)) {
    return `Tipo de arquivo não permitido. Use: ${ANEXO_EXTENSOES_TEXTO}.`;
  }
  return null;
}

/**
 * Devolve o arquivo com o MIME da extensão (o navegador às vezes manda vazio ou outro tipo, e o backend recusa
 * extensão incompatível com o MIME). Só chamar depois de `validarAnexo`.
 */
export function prepararAnexo(arquivo: File): File {
  const mime = MIME_POR_EXTENSAO[extensaoDe(arquivo.name)];
  if (!mime || arquivo.type === mime) return arquivo;
  return new File([arquivo], arquivo.name, { type: mime, lastModified: arquivo.lastModified });
}
