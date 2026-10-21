/**
 * Regras de upload de foto de relatório fotográfico, espelhando `FileUploadValidator` + `FotoRegras` do backend (que
 * seguem sendo a fonte: o servidor ainda confere MIME e magic bytes). Aqui só o que dá para recusar antes de enviar.
 */
export const FOTO_MAX_BYTES = 10 * 1024 * 1024;
export const FOTO_MAX_POR_RELATORIO = 100;
export const FOTO_NOME_MAX = 255;
export const FOTO_DESCRICAO_MAX = 255;

export const FOTO_EXTENSOES = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;

/** Valor para o atributo `accept` do `<input type="file">`. */
export const FOTO_ACCEPT = FOTO_EXTENSOES.join(',');

/** "JPG, JPEG, PNG, WEBP, GIF" para mensagens. */
export const FOTO_EXTENSOES_TEXTO = FOTO_EXTENSOES.map((e) => e.slice(1).toUpperCase()).join(', ');

function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto < 0 ? '' : nome.slice(ponto).toLowerCase();
}

/** Mensagem de erro (em português) ou null se a foto pode ser enviada. */
export function validarFoto(arquivo: { name: string; size: number }): string | null {
  if (arquivo.size <= 0) return 'O arquivo está vazio.';
  if (arquivo.size > FOTO_MAX_BYTES) return 'O arquivo excede o tamanho máximo de 10 MB.';
  if (arquivo.name.trim() === '') return 'O arquivo não tem nome.';
  if (arquivo.name.length > FOTO_NOME_MAX) return `O nome do arquivo deve ter no máximo ${FOTO_NOME_MAX} caracteres.`;
  if (!(FOTO_EXTENSOES as readonly string[]).includes(extensaoDe(arquivo.name))) {
    return `Só imagens são aceitas. Use: ${FOTO_EXTENSOES_TEXTO}.`;
  }
  return null;
}
