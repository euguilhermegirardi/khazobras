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

describe('casos adversariais', () => {
  describe('seleção e bordas do texto', () => {
    it('seleção que começa e termina no meio de palavra envolve só o trecho selecionado', () => {
      expect(aplicar('con[clu]ída', 'negrito')).toBe('con**[clu]**ída');
      expect(aplicar('con[clu]ída', 'italico')).toBe('con*[clu]*ída');
    });

    it('cursor no começo e no fim do texto insere o par ali', () => {
      expect(aplicar('|abc', 'italico')).toBe('*|*abc');
      expect(aplicar('abc|', 'italico')).toBe('abc*|*');
      expect(aplicar('|abc', 'negrito')).toBe('**|**abc');
      expect(aplicar('abc|', 'negrito')).toBe('abc**|**');
    });

    it('texto vazio: negrito, itálico, título e numerada inserem a marcação com o cursor depois', () => {
      expect(aplicar('|', 'negrito')).toBe('**|**');
      expect(aplicar('|', 'italico')).toBe('*|*');
      expect(aplicar('|', 'titulo')).toBe('## |');
      expect(aplicar('|', 'numerada')).toBe('1. |');
    });

    it('só quebras de linha: o cursor numa linha em branco ganha o prefixo, sem mexer nas outras', () => {
      expect(aplicar('\n|\n', 'lista')).toBe('\n- |\n');
      expect(aplicar('\n|\n', 'titulo')).toBe('\n## |\n');
    });

    it('seleção só de quebras de linha não altera o texto (nada a formatar em lista/título)', () => {
      const estado: EstadoTexto = { texto: '\n\n\n', inicio: 0, fim: 3 };
      for (const formato of ['lista', 'numerada', 'titulo'] as const) {
        expect(aplicarFormato(estado, formato).texto).toBe('\n\n\n');
      }
      expect(aplicarFormato(estado, 'negrito').texto).toBe('\n\n\n');
    });

    it('várias linhas com linhas em branco no meio: prefixa só as com texto e mantém as em branco', () => {
      expect(aplicar('[a\n\n\nb]', 'lista')).toBe('[- a\n\n\n- b]');
      expect(aplicar('[a\n\nb]', 'titulo')).toBe('[## a\n\n## b]');
      expect(aplicar('[a\n\n\nb\n\nc]', 'numerada')).toBe('[1. a\n\n\n2. b\n\n3. c]');
    });

    it('seleção de linhas parciais (meio de uma até o meio de outra) formata as duas linhas inteiras', () => {
      expect(aplicar('pri[meira\nsegu]nda\nterceira', 'lista')).toBe('[- primeira\n- segunda]\nterceira');
    });
  });

  describe('alternar (desfazer) duas vezes devolve o texto original', () => {
    const entradas = ['Obra [concluída] hoje', '[um\n\ndois]', '[a\nb\nc]', 'linha com cur|sor', '[  recuada  ]', '|'];
    for (const formato of ['negrito', 'italico', 'titulo', 'lista', 'numerada'] as const) {
      it(`${formato}: aplicar e aplicar de novo`, () => {
        for (const entrada of entradas) {
          const original = dado(entrada);
          const uma = aplicarFormato(original, formato);
          const duas = aplicarFormato(uma, formato);
          expect(duas.texto, `${formato} em ${JSON.stringify(entrada)}`).toBe(original.texto);
        }
      });
    }
  });

  describe('prefixo diferente na linha', () => {
    it('título sobre lista, lista numerada ou título de outro nível troca o prefixo (sem acumular)', () => {
      expect(aplicar('- x|', 'titulo')).toBe('## x|');
      expect(aplicar('1. x|', 'titulo')).toBe('## x|');
      expect(aplicar('+ x|', 'titulo')).toBe('## x|');
    });

    it('lista e numerada sobre título trocam o prefixo', () => {
      expect(aplicar('## x|', 'lista')).toBe('- x|');
      expect(aplicar('# x|', 'lista')).toBe('- x|');
      expect(aplicar('## x|', 'numerada')).toBe('1. x|');
      expect(aplicar('10. x|', 'lista')).toBe('- x|');
    });

    it('numerada sobre linhas com prefixos misturados renumera todas (1, 2, 3)', () => {
      expect(aplicar('[- a\n7. b\nc]', 'numerada')).toBe('[1. a\n2. b\n3. c]');
    });

    it('lista numerada com várias linhas desfaz de todas, mesmo com numeração qualquer', () => {
      expect(aplicar('[3. a\n9. b]', 'numerada')).toBe('[a\nb]');
    });

    it('mantém o recuo da linha', () => {
      expect(aplicar('  tex|to', 'lista')).toBe('  - tex|to');
      expect(aplicar('  - tex|to', 'lista')).toBe('  tex|to');
    });

    it('número ou traço colado no texto não é prefixo ("1.5 m", "-5 graus")', () => {
      expect(aplicar('1.5 m|', 'numerada')).toBe('1. 1.5 m|');
      expect(aplicar('-5 graus|', 'lista')).toBe('- -5 graus|');
    });
  });

  describe('\\r\\n e Unicode (índices em UTF-16)', () => {
    it('\\r\\n: lista, título e negrito em várias linhas preservam o \\r e as linhas em branco', () => {
      const texto = 'um\r\n\r\ndois';
      const tudo: EstadoTexto = { texto, inicio: 0, fim: texto.length };
      expect(aplicarFormato(tudo, 'lista').texto).toBe('- um\r\n\r\n- dois');
      expect(aplicarFormato(tudo, 'titulo').texto).toBe('## um\r\n\r\n## dois');
      expect(aplicarFormato(tudo, 'negrito').texto).toBe('**um**\r\n\r\n**dois**');
      expect(aplicarFormato(aplicarFormato(tudo, 'lista'), 'lista').texto).toBe(texto);
      expect(aplicarFormato(aplicarFormato(tudo, 'negrito'), 'negrito').texto).toBe(texto);
    });

    it('emoji (par substituto) selecionado é envolvido inteiro', () => {
      const texto = 'ação 😀 fim';
      const inicio = texto.indexOf('😀');
      const r = aplicarFormato({ texto, inicio, fim: inicio + 2 }, 'negrito');
      expect(r.texto).toBe('ação **😀** fim');
      expect(r.texto.slice(r.inicio, r.fim)).toBe('😀');
    });

    it('cursor depois de emoji e acento acompanha o prefixo da linha (2 unidades UTF-16 do emoji)', () => {
      const texto = '😀 ação';
      const r = aplicarFormato({ texto, inicio: texto.length, fim: texto.length }, 'lista');
      expect(r.texto).toBe('- 😀 ação');
      expect(r.inicio).toBe(r.texto.length);
    });

    it('acentos decompostos (a + til combinante) selecionados são envolvidos sem separar', () => {
      const texto = 'ão x';
      const r = aplicarFormato({ texto, inicio: 0, fim: 3 }, 'italico');
      expect(r.texto).toBe('*ão* x');
    });
  });

  describe('limite de 20000 caracteres', () => {
    it('a função pura não corta o texto: passar do limite é decidido (e avisado) pelo formulário', () => {
      const texto = 'x'.repeat(19999);
      const r = aplicarFormato({ texto, inicio: 0, fim: texto.length }, 'negrito');
      expect(r.texto).toHaveLength(20003);
      expect(r.texto.startsWith('**x')).toBe(true);
      expect(r.texto.endsWith('x**')).toBe(true);
    });
  });
});
