/** Profundidade máxima de contêineres de bloco (`>`, itens de lista) empilhados no início de uma linha. */
export const MARKDOWN_PROFUNDIDADE_MAX = 6;
/** Linhas de item/citação acima disso (num texto de no máximo 20000 caracteres) são tratadas como patológicas. */
export const MARKDOWN_LINHAS_BLOCO_MAX = 2000;

// Caracteres de direção/invisíveis: ALM, ZWSP..RLM (inclui ZWNJ, ZWJ, LRM), LRE..RLO, LRI..PDI, BOM.
const BIDI_E_INVISIVEIS = new RegExp(String.raw`[؜​-‏‪-‮⁦-⁩﻿]`, 'g');

/** Remove caracteres bidirecionais/invisíveis (inclusive os que chegam como `&#x202E;` depois do parse). */
export function removerBidi(texto: string): string {
  return texto.replace(BIDI_E_INVISIVEIS, '');
}

function ehEspaco(c: string | undefined): boolean {
  return c === ' ' || c === '\t';
}

/** Quantos marcadores de bloco (`>`, `-`/`+`/`*`, `1.`/`1)`) vêm seguidos no começo da linha. Linear na linha. */
function profundidadeDaLinha(linha: string): number {
  let i = 0;
  let profundidade = 0;
  const n = linha.length;
  while (i < n) {
    while (ehEspaco(linha[i])) i += 1;
    const c = linha[i];
    if (c === '>') {
      profundidade += 1;
      i += 1;
      continue;
    }
    if ((c === '-' || c === '+' || c === '*') && (i + 1 >= n || ehEspaco(linha[i + 1]))) {
      profundidade += 1;
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && j - i < 9 && linha[j] !== undefined && linha[j]! >= '0' && linha[j]! <= '9') j += 1;
    if (j > i && (linha[j] === '.' || linha[j] === ')') && (j + 1 >= n || ehEspaco(linha[j + 1]))) {
      profundidade += 1;
      i = j + 1;
      continue;
    }
    break;
  }
  return profundidade;
}

/**
 * True quando o texto aninharia contêineres de bloco além do que o leitor Markdown aguenta (a pilha estoura em
 * `'+ '.repeat(10000)`, `'> '.repeat(10000)`...). Nesses casos o texto vai cru, como era o texto puro antigo.
 */
export function markdownPatologico(texto: string): boolean {
  let linhasDeBloco = 0;
  let inicio = 0;
  while (inicio <= texto.length) {
    let fim = texto.indexOf('\n', inicio);
    if (fim === -1) fim = texto.length;
    const profundidade = profundidadeDaLinha(texto.slice(inicio, fim));
    if (profundidade > MARKDOWN_PROFUNDIDADE_MAX) return true;
    if (profundidade > 0) {
      linhasDeBloco += 1;
      if (linhasDeBloco > MARKDOWN_LINHAS_BLOCO_MAX) return true;
    }
    inicio = fim + 1;
  }
  return false;
}
