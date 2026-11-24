import { describe, expect, it } from 'vitest';
import { aplicarFormato, type EstadoTexto, type FormatoMarkdown } from './markdownEdicao';

/** `[` e `]` marcam a seleção no texto de entrada e de saída (`|` = só o cursor). */
function dado(marcado: string): EstadoTexto {
  const cursor = marcado.indexOf('|');
  if (cursor >= 0) return { texto: marcado.replace('|', ''), inicio: cursor, fim: cursor };
  const inicio = marcado.indexOf('[');
  const fim = marcado.indexOf(']') - 1;
  return { texto: marcado.replace('[', '').replace(']', ''), inicio, fim };
}

function marcar({ texto, inicio, fim }: EstadoTexto): string {
  if (inicio === fim) return `${texto.slice(0, inicio)}|${texto.slice(inicio)}`;
  return `${texto.slice(0, inicio)}[${texto.slice(inicio, fim)}]${texto.slice(fim)}`;
}

const aplicar = (marcado: string, formato: FormatoMarkdown) => marcar(aplicarFormato(dado(marcado), formato));

describe('negrito e itálico', () => {
  it('com seleção, envolve e mantém o texto selecionado', () => {
    expect(aplicar('Obra [concluída] hoje', 'negrito')).toBe('Obra **[concluída]** hoje');
    expect(aplicar('Obra [concluída] hoje', 'italico')).toBe('Obra *[concluída]* hoje');
  });

  it('sem seleção, insere o par com o cursor no meio', () => {
    expect(aplicar('Texto |', 'negrito')).toBe('Texto **|**');
    expect(aplicar('Texto |', 'italico')).toBe('Texto *|*');
  });

  it('alterna: seleção já envolvida (marcador dentro) desfaz', () => {
    expect(aplicar('[**x**]', 'negrito')).toBe('[x]');
    expect(aplicar('[*x*]', 'italico')).toBe('[x]');
  });

  it('alterna: marcador em volta da seleção desfaz', () => {
    expect(aplicar('**[x]**', 'negrito')).toBe('[x]');
    expect(aplicar('*[x]*', 'italico')).toBe('[x]');
  });

  it('cursor entre o par vazio desfaz o par', () => {
    expect(aplicar('a **|** b', 'negrito')).toBe('a | b');
  });

  it('itálico não confunde negrito com itálico, e vice-versa', () => {
    expect(aplicar('**[x]**', 'italico')).toBe('***[x]***');
    expect(aplicar('***[x]***', 'negrito')).toBe('*[x]*');
    expect(aplicar('***[x]***', 'italico')).toBe('**[x]**');
    expect(aplicar('*[x]*', 'negrito')).toBe('***[x]***');
  });

  it('espaços nas pontas da seleção ficam fora do marcador', () => {
    expect(aplicar('a[ texto ]b', 'negrito')).toBe('a **[texto]** b');
  });

  it('seleção só de espaços vira cursor', () => {
    expect(aplicar('a[ ]b', 'negrito')).toBe('a**|** b');
  });

  it('várias linhas: formata cada linha e pula as em branco', () => {
    expect(aplicar('[um\n\ndois]', 'negrito')).toBe('[**um**\n\n**dois**]');
  });

  it('várias linhas: se todas já estão formatadas, desfaz todas', () => {
    expect(aplicar('[**um**\n\n**dois**]', 'negrito')).toBe('[um\n\ndois]');
  });

  it('várias linhas: mistura envolve só as que faltam', () => {
    expect(aplicar('[**um**\ndois]', 'negrito')).toBe('[**um**\n**dois**]');
  });
});

describe('título', () => {
  it('sem seleção, prefixa a linha atual e o cursor acompanha', () => {
    expect(aplicar('Resumo\nObra| parada', 'titulo')).toBe('Resumo\n## Obra| parada');
  });

  it('alterna: linha com título volta a ser texto', () => {
    expect(aplicar('## Res|umo', 'titulo')).toBe('Res|umo');
  });

  it('trata título de outro nível como título (remove)', () => {
    expect(aplicar('# Resumo|', 'titulo')).toBe('Resumo|');
  });

  it('cursor numa linha vazia insere o prefixo', () => {
    expect(aplicar('a\n|\nb', 'titulo')).toBe('a\n## |\nb');
  });

  it('troca o prefixo de lista pelo de título', () => {
    expect(aplicar('- iten|', 'titulo')).toBe('## iten|');
  });
});

describe('lista e lista numerada', () => {
  it('lista com seleção em várias linhas prefixa as com texto', () => {
    expect(aplicar('[um\n\ndois]\nfora', 'lista')).toBe('[- um\n\n- dois]\nfora');
  });

  it('numerada numera só as linhas com texto', () => {
    expect(aplicar('[um\n\ndois\ntrês]', 'numerada')).toBe('[1. um\n\n2. dois\n3. três]');
  });

  it('alterna: todas com prefixo remove de todas', () => {
    expect(aplicar('[- um\n- dois]', 'lista')).toBe('[um\ndois]');
    expect(aplicar('[1. um\n2. dois]', 'numerada')).toBe('[um\ndois]');
  });

  it('mistura (uma sem prefixo) prefixa todas', () => {
    expect(aplicar('[- um\ndois]', 'lista')).toBe('[- um\n- dois]');
  });

  it('lista -> numerada troca o prefixo', () => {
    expect(aplicar('[- um\n- dois]', 'numerada')).toBe('[1. um\n2. dois]');
  });

  it('seleção que termina depois de um "\\n" não puxa a linha seguinte', () => {
    const estado: EstadoTexto = { texto: 'um\ndois', inicio: 0, fim: 3 };
    expect(aplicarFormato(estado, 'lista').texto).toBe('- um\ndois');
  });

  it('sem seleção prefixa só a linha do cursor; desfazer devolve o cursor', () => {
    expect(aplicar('um\ndo|is', 'lista')).toBe('um\n- do|is');
    expect(aplicar('um\n- do|is', 'lista')).toBe('um\ndo|is');
  });

  it('não confunde negrito (**) com marcador de lista', () => {
    expect(aplicar('**forte**|', 'lista')).toBe('- **forte**|');
  });

  it('texto vazio: lista insere o prefixo e o cursor fica depois dele', () => {
    expect(aplicar('|', 'lista')).toBe('- |');
  });
});
