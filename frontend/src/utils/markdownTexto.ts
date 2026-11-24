// Endereço do link: aceita um nível de parênteses (`javascript:alert(1)`, `https://x/a_(b)`).
const ENDERECO = String.raw`\((?:[^()]|\([^)]*\))*\)`;
const IMAGEM = new RegExp(String.raw`!\[([^\]]*)\]${ENDERECO}`, 'g');
const LINK = new RegExp(String.raw`\[([^\]]*)\]${ENDERECO}`, 'g');
const NEGRITO = /\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g;
const ITALICO = /\*([^\s*](?:[^*]*[^\s*])?)\*/g;
// Negrito com itálico dentro (`**a *b* c**`) só fecha na segunda volta: o miolo do negrito não pode ter `*`.
const VOLTAS_ENFASE = 3;

function removerEnfase(texto: string): string {
  let atual = texto;
  for (let volta = 0; volta < VOLTAS_ENFASE; volta += 1) {
    const proximo = atual.replace(NEGRITO, '$1').replace(ITALICO, '$1');
    if (proximo === atual) break;
    atual = proximo;
  }
  return atual;
}

/**
 * Markdown -> texto simples numa linha só, para prévias curtas (colunas e cartões), onde `**` e `##` quebrariam o
 * layout. Remove os marcadores que o editor gera (negrito, itálico, título, listas) e o que o leitor Markdown
 * também aceitaria (links e imagens viram o texto). Texto sem marcação passa igual, com espaços normalizados.
 */
export function markdownParaTexto(conteudo: string): string {
  const semMarcadores = conteudo
    .replace(IMAGEM, '$1')
    .replace(LINK, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '');
  return removerEnfase(semMarcadores).replace(/\s+/g, ' ').trim();
}
