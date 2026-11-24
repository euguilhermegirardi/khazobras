import { describe, expect, it } from 'vitest';
import { markdownParaTexto } from './markdownTexto';

describe('markdownParaTexto', () => {
  it('remove negrito, itálico, título e marcadores de lista', () => {
    const md = '## Resumo\n\nObra **adiantada** e *sem* pendências.\n- Fundação\n1. Laje';
    expect(markdownParaTexto(md)).toBe('Resumo Obra adiantada e sem pendências. Fundação Laje');
  });

  it('negrito com itálico dentro', () => {
    expect(markdownParaTexto('***forte***')).toBe('forte');
  });

  it('link e imagem viram só o texto', () => {
    expect(markdownParaTexto('veja [o site](https://x.com) ![foto](a.png)')).toBe('veja o site foto');
  });

  it('texto antigo sem marcação passa igual (espaços normalizados)', () => {
    expect(markdownParaTexto('Linha 1\n\n  Linha 3')).toBe('Linha 1 Linha 3');
  });

  it('asterisco solto (multiplicação) não é apagado', () => {
    expect(markdownParaTexto('5 * 3 * 2')).toBe('5 * 3 * 2');
  });

  it('negrito com itálico dentro (o que o editor gera ao italicizar uma palavra de um trecho em negrito)', () => {
    expect(markdownParaTexto('**obra *quase* pronta**')).toBe('obra quase pronta');
    expect(markdownParaTexto('*obra **quase** pronta*')).toBe('obra quase pronta');
    expect(markdownParaTexto('**a *b* c** e *d*')).toBe('a b c e d');
  });

  it('texto vazio, só espaços e só quebras de linha viram vazio', () => {
    expect(markdownParaTexto('')).toBe('');
    expect(markdownParaTexto('  \n\n \t ')).toBe('');
  });

  it('\\r\\n e quebras duplas viram um espaço só', () => {
    expect(markdownParaTexto('a\r\n\r\nb\r\n- c')).toBe('a b c');
  });

  it('marcadores sem fechamento ou truncados no meio não derrubam nem somem com o texto', () => {
    expect(markdownParaTexto('**aberto sem fim')).toBe('**aberto sem fim');
    expect(markdownParaTexto('texto **neg')).toBe('texto **neg');
    expect(markdownParaTexto('[link sem fim](http://x')).toBe('[link sem fim](http://x');
  });

  it('HTML cru e entidades ficam como texto (nunca interpretados)', () => {
    expect(markdownParaTexto('<script>alert(1)</script> <b>x</b>')).toBe('<script>alert(1)</script> <b>x</b>');
  });

  it('link com javascript: e imagem viram só o texto, sem o endereço', () => {
    expect(markdownParaTexto('[clique](javascript:alert(1)) ![alt](http://x/y.png)')).toBe('clique alt');
  });

  it('título dentro do texto, lista com negrito e itálico', () => {
    expect(markdownParaTexto('## Título **forte**\n- *a*\n- **b**')).toBe('Título forte a b');
  });

  it('emoji e acentos passam intactos', () => {
    expect(markdownParaTexto('**ação** 😀 *êxito*')).toBe('ação 😀 êxito');
  });

  it('20000 caracteres de marcação aninhada ou mal formada terminam rápido e sem exceção', () => {
    const entradas = ['*'.repeat(20000), '['.repeat(20000), '!['.repeat(10000), '**a'.repeat(6600), '*a '.repeat(6600)];
    for (const entrada of entradas) {
      const inicio = performance.now();
      expect(typeof markdownParaTexto(entrada)).toBe('string');
      expect(performance.now() - inicio).toBeLessThan(2000);
    }
  });
});
