/**
 * Markdown -> texto simples numa linha só, para prévias curtas (colunas e cartões), onde `**` e `##` quebrariam o
 * layout. Remove os marcadores que o editor gera (negrito, itálico, título, listas) e o que o leitor Markdown
 * também aceitaria (links e imagens viram o texto). Texto sem marcação passa igual, com espaços normalizados.
 */
export function markdownParaTexto(conteudo: string): string {
  return conteudo
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '')
    .replace(/\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g, '$1')
    .replace(/\*([^\s*](?:[^*]*[^\s*])?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
