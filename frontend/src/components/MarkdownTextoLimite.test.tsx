import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownTexto } from './MarkdownTexto';

/**
 * Entradas que o validador aceita (até 20000 caracteres) mas que estressam o leitor Markdown. Arquivo próprio: são
 * os casos mais lentos do componente. O texto vem de um admin e é mostrado ao cliente e na prévia do editor.
 */
describe('MarkdownTexto - aninhamento extremo (limite de 20000 caracteres)', () => {
  it('20000 caracteres de citações aninhadas ("> " x 10000) não derrubam a tela', () => {
    expect(() => render(<MarkdownTexto conteudo={'> '.repeat(10000)} />)).not.toThrow();
  });

  it('listas numeradas aninhadas ("1. " x 2500) não derrubam a tela', () => {
    expect(() => render(<MarkdownTexto conteudo={'1. '.repeat(2500)} />)).not.toThrow();
  });
});

describe('MarkdownTexto - texto antigo recuado', () => {
  it('linhas recuadas em 4 espaços depois de linha em branco mantêm as quebras de linha', () => {
    const { container } = render(<MarkdownTexto conteudo={'Itens:\n\n    pisos\n    telhado\n    pintura'} />);

    // O texto (com os "\n") precisa estar num elemento que preserva a quebra (`whitespace-pre-line`), como os demais.
    const dono = Array.from(container.querySelectorAll('*'))
      .filter((e) => e.textContent?.includes('pisos\ntelhado'))
      .at(-1);
    expect(dono, 'texto das linhas recuadas').toBeDefined();
    expect(dono?.className).toContain('whitespace-pre');
  });
});
