import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownTexto } from './MarkdownTexto';
import { markdownPatologico } from '@/utils/markdownSeguro';

// Folgado de propósito: jsdom em máquina lenta. O que importa é não estourar a pilha nem levar segundos.
const LIMITE_MS = 1500;

const PATOLOGICOS: [string, string][] = [
  ['"+ " x 10000', '+ '.repeat(10000)],
  ['"+ " x 2000', '+ '.repeat(2000)],
  ['"1. " x 6666', '1. '.repeat(6666)],
  ['">" x 4000', '>'.repeat(4000)],
  ['">" x 20000', '>'.repeat(20000)],
  ['"> " x 10000', '> '.repeat(10000)],
  ['"- > 1) " x 3000', '- > 1) '.repeat(3000)],
];

describe('MarkdownTexto - texto patológico cai no texto cru', () => {
  it.each(PATOLOGICOS)('%s não lança e mostra o texto cru, rápido', (_nome, texto) => {
    const inicio = performance.now();
    const { container } = render(<MarkdownTexto conteudo={texto} />);
    expect(performance.now() - inicio).toBeLessThan(LIMITE_MS);

    expect(markdownPatologico(texto)).toBe(true);
    const cru = container.querySelector('p.whitespace-pre-wrap');
    expect(cru, 'fallback em texto cru').not.toBeNull();
    expect(cru?.textContent).toBe(texto);
    expect(container.querySelector('ul, ol, blockquote, li')).toBeNull();
  });

  it('muitas linhas de item (acima do limite) também vão cru', () => {
    const texto = '- a\n'.repeat(2500);
    expect(markdownPatologico(texto)).toBe(true);
    const { container } = render(<MarkdownTexto conteudo={texto} />);
    expect(container.querySelector('li')).toBeNull();
  });

  it.each([
    ['"*a" x 10000', '*a'.repeat(10000)],
    [
      'texto normal de 20000 caracteres',
      'Concretagem da laje do segundo pavimento concluída. '.repeat(400).slice(0, 20000),
    ],
  ])('%s renderiza sem lançar, rápido', (_nome, texto) => {
    const inicio = performance.now();
    expect(() => render(<MarkdownTexto conteudo={texto} />)).not.toThrow();
    expect(performance.now() - inicio).toBeLessThan(LIMITE_MS * 4);
  });
});

describe('MarkdownTexto - uso normal continua em Markdown', () => {
  it('listas aninhadas por recuo e citação simples não são tratadas como patológicas', () => {
    expect(markdownPatologico('- a\n  - b\n    - c\n1. x\n2. y')).toBe(false);
    expect(markdownPatologico('> citação\n> - item')).toBe(false);
    expect(markdownPatologico('- > 1. a')).toBe(false);
  });

  it('lista com marcadores renderiza como lista', () => {
    const { container } = render(<MarkdownTexto conteudo={'- pisos\n- telhado'} />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('limite exato: 6 marcadores passam; 7 vão cru', () => {
    expect(markdownPatologico('> '.repeat(6) + 'a')).toBe(false);
    expect(markdownPatologico('> '.repeat(7) + 'a')).toBe(true);
  });
});

describe('MarkdownTexto - caracteres bidi e invisíveis', () => {
  it.each([
    ['A&#x202E;CBA&#x202C;Z', 'ACBAZ'],
    ['a&rlm;b', 'ab'],
    ['a&lrm;b', 'ab'],
    ['a&zwj;b', 'ab'],
    ['a&#x200B;b', 'ab'],
    ['a&#xFEFF;b', 'ab'],
    ['a&#x061C;b', 'ab'],
    ['a&#x2066;b&#x2069;c', 'abc'],
    ['**a&#x202E;b**', 'ab'],
  ])('entidade em %j não chega ao DOM', (entrada, esperado) => {
    const { container } = render(<MarkdownTexto conteudo={entrada} />);
    expect(container.textContent).toBe(esperado);
    expect(container.textContent).not.toMatch(/[؜​-‏‪-‮⁦-⁩﻿]/);
  });

  it('o texto cru (fallback) também sai sem bidi', () => {
    const texto = '> '.repeat(10) + 'a‮b​c';
    const { container } = render(<MarkdownTexto conteudo={texto} />);
    expect(container.querySelector('p.whitespace-pre-wrap')?.textContent).toBe('> '.repeat(10) + 'abc');
  });
});
