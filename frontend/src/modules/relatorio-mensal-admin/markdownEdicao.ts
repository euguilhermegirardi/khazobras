/**
 * Edição de Markdown simples no textarea do relatório: funções puras (texto + seleção entram, texto + seleção saem).
 * Só cinco formatos, de propósito: negrito, itálico, título, lista e lista numerada (sem link, imagem, HTML, tabela
 * ou código). Quem chama aplica o resultado no textarea e restaura a seleção.
 */
export interface EstadoTexto {
  texto: string;
  /** Início da seleção (`selectionStart`). */
  inicio: number;
  /** Fim da seleção (`selectionEnd`); igual ao início = só o cursor. */
  fim: number;
}

export type FormatoInline = 'negrito' | 'italico';
export type FormatoLinha = 'titulo' | 'lista' | 'numerada';
export type FormatoMarkdown = FormatoInline | FormatoLinha;

const MARCADOR: Record<FormatoInline, string> = { negrito: '**', italico: '*' };

const PREFIXO_LINHA: Record<FormatoLinha, RegExp> = {
  titulo: /^#{1,6}[ \t]+/,
  lista: /^[-*+][ \t]+/,
  numerada: /^\d+\.[ \t]+/,
};
// Qualquer prefixo de bloco: trocar de lista para título (ou o contrário) substitui o anterior.
const PREFIXO_QUALQUER = /^(?:#{1,6}|[-*+]|\d+\.)[ \t]+/;

const corridaInicial = (texto: string): number => /^\*+/.exec(texto)?.[0].length ?? 0;
const corridaFinal = (texto: string): number => /\*+$/.exec(texto)?.[0].length ?? 0;

/** Uma corrida de asteriscos "contém" o marcador: negrito = 2 ou mais; itálico = quantidade ímpar (1 ou 3). */
function contemMarcador(formato: FormatoInline, corrida: number): boolean {
  return formato === 'negrito' ? corrida >= 2 : corrida % 2 === 1;
}

/** `true` se o trecho já vem envolvido pelo marcador (`**x**`, `*x*`) e tem miolo. */
function estaEnvolvido(formato: FormatoInline, trecho: string): boolean {
  const abre = corridaInicial(trecho);
  const resto = trecho.slice(abre);
  const fecha = corridaFinal(resto);
  return contemMarcador(formato, abre) && contemMarcador(formato, fecha) && resto.length > fecha;
}

function removerMarcador(formato: FormatoInline, trecho: string): string {
  const t = MARCADOR[formato].length;
  return trecho.slice(t, trecho.length - t);
}

/** Separa espaços das pontas da linha (o marcador cola no texto: `**a **` não vira negrito em Markdown). */
function partirEspacos(linha: string): { antes: string; miolo: string; depois: string } {
  const miolo = linha.trim();
  if (miolo === '') return { antes: linha, miolo: '', depois: '' };
  return {
    antes: linha.slice(0, linha.length - linha.trimStart().length),
    miolo,
    depois: linha.slice(linha.trimEnd().length),
  };
}

function alternarInlineMultilinha(estado: EstadoTexto, formato: FormatoInline): EstadoTexto {
  const { texto, inicio, fim } = estado;
  const m = MARCADOR[formato];
  const partes = texto
    .slice(inicio, fim)
    .split('\n')
    .map((linha) => partirEspacos(linha));
  const comTexto = partes.filter((p) => p.miolo !== '');
  const todasEnvolvidas = comTexto.length > 0 && comTexto.every((p) => estaEnvolvido(formato, p.miolo));
  const bloco = partes
    .map((p) => {
      if (p.miolo === '') return p.antes;
      if (todasEnvolvidas) return p.antes + removerMarcador(formato, p.miolo) + p.depois;
      // Mistura: envolve só as que ainda não estão.
      return estaEnvolvido(formato, p.miolo) ? p.antes + p.miolo + p.depois : `${p.antes}${m}${p.miolo}${m}${p.depois}`;
    })
    .join('\n');
  return { texto: texto.slice(0, inicio) + bloco + texto.slice(fim), inicio, fim: inicio + bloco.length };
}

/**
 * Negrito/itálico. Com seleção: envolve; se já está formatado (marcador dentro ou em volta da seleção), desfaz. Sem
 * seleção: insere o par de marcadores com o cursor no meio (ou desfaz, se o cursor está entre `**` e `**`). Seleção
 * de várias linhas formata cada linha separadamente (Markdown não atravessa parágrafos).
 */
export function alternarInline(estado: EstadoTexto, formato: FormatoInline): EstadoTexto {
  const m = MARCADOR[formato];
  const t = m.length;
  const { texto } = estado;
  let { inicio, fim } = estado;

  if (texto.slice(inicio, fim).includes('\n')) return alternarInlineMultilinha(estado, formato);

  // Espaços nas pontas da seleção ficam de fora; só espaços = cursor.
  const bruto = texto.slice(inicio, fim);
  if (bruto.trim() === '') fim = inicio;
  else {
    inicio += bruto.length - bruto.trimStart().length;
    fim -= bruto.length - bruto.trimEnd().length;
  }
  const antes = texto.slice(0, inicio);
  const selecionado = texto.slice(inicio, fim);
  const depois = texto.slice(fim);

  // Marcador dentro da seleção: `[**x**]` -> `[x]`.
  if (estaEnvolvido(formato, selecionado)) {
    const miolo = removerMarcador(formato, selecionado);
    return { texto: antes + miolo + depois, inicio, fim: inicio + miolo.length };
  }
  // Marcador em volta da seleção (ou do cursor): `**[x]**` -> `[x]`.
  if (contemMarcador(formato, corridaFinal(antes)) && contemMarcador(formato, corridaInicial(depois))) {
    return { texto: antes.slice(0, -t) + selecionado + depois.slice(t), inicio: inicio - t, fim: fim - t };
  }
  return { texto: `${antes}${m}${selecionado}${m}${depois}`, inicio: inicio + t, fim: fim + t };
}

/**
 * Título (`## `), lista (`- `) e lista numerada (`1. `) nas linhas tocadas pela seleção (ou na linha do cursor).
 * Se todas já têm o prefixo, remove; senão põe em todas (trocando outro prefixo de bloco). Em várias linhas, as em
 * branco ficam como estão e a numeração só conta as com texto.
 */
export function alternarLinhas(estado: EstadoTexto, formato: FormatoLinha): EstadoTexto {
  const { texto, inicio, fim } = estado;
  const comeco = inicio === 0 ? 0 : texto.lastIndexOf('\n', inicio - 1) + 1;
  // Seleção que termina logo depois de um "\n" não puxa a linha seguinte.
  const fimUtil = fim > inicio && texto[fim - 1] === '\n' ? fim - 1 : fim;
  const quebra = texto.indexOf('\n', fimUtil);
  const fimBloco = quebra === -1 ? texto.length : quebra;

  const linhas = texto.slice(comeco, fimBloco).split('\n');
  const unica = linhas.length === 1;
  const alvo = (linha: string) => unica || linha.trim() !== '';
  const semRecuo = (linha: string) => linha.trimStart();
  const recuoDe = (linha: string) => linha.slice(0, linha.length - semRecuo(linha).length);

  const candidatas = linhas.filter(alvo);
  const remover = candidatas.length > 0 && candidatas.every((l) => PREFIXO_LINHA[formato].test(semRecuo(l)));
  let numero = 0;
  const novas = linhas.map((linha) => {
    if (!alvo(linha)) return linha;
    const corpo = semRecuo(linha);
    if (remover) return recuoDe(linha) + corpo.replace(PREFIXO_LINHA[formato], '');
    const limpo = corpo.replace(PREFIXO_QUALQUER, '');
    numero += 1;
    const prefixo = formato === 'titulo' ? '## ' : formato === 'lista' ? '- ' : `${numero}. `;
    return recuoDe(linha) + prefixo + limpo;
  });
  const bloco = novas.join('\n');
  const novoTexto = texto.slice(0, comeco) + bloco + texto.slice(fimBloco);

  // Só o cursor: acompanha o deslocamento da linha. Com seleção: seleciona o bloco inteiro já formatado.
  if (inicio === fim) {
    const cursor = Math.max(comeco, inicio + (bloco.length - (fimBloco - comeco)));
    return { texto: novoTexto, inicio: cursor, fim: cursor };
  }
  return { texto: novoTexto, inicio: comeco, fim: comeco + bloco.length };
}

/** Ponto único: aplica o formato do botão/atalho ao estado do textarea. */
export function aplicarFormato(estado: EstadoTexto, formato: FormatoMarkdown): EstadoTexto {
  return formato === 'negrito' || formato === 'italico'
    ? alternarInline(estado, formato)
    : alternarLinhas(estado, formato);
}
