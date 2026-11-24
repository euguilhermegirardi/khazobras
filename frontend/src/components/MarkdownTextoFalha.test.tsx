import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownTexto } from './MarkdownTexto';

vi.mock('react-markdown', () => ({
  default: () => {
    throw new Error('falha simulada do leitor Markdown');
  },
}));

describe('MarkdownTexto - falha do leitor Markdown', () => {
  it('cai no texto puro sem derrubar a página ao redor', () => {
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <main>
        <h1>Relatório de setembro</h1>
        <MarkdownTexto conteudo={'Texto **importante**\nsegunda linha'} />
      </main>,
    );

    expect(screen.getByRole('heading', { name: 'Relatório de setembro' })).toBeInTheDocument();
    const cru = document.querySelector('p.whitespace-pre-wrap');
    expect(cru?.textContent).toBe('Texto **importante**\nsegunda linha');
    erroConsole.mockRestore();
  });
});
