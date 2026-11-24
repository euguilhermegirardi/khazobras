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
});
