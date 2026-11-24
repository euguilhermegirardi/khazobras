import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownTexto } from './MarkdownTexto';

describe('MarkdownTexto', () => {
  it('renderiza negrito, itálico, listas e títulos', () => {
    const { container } = render(
      <MarkdownTexto
        conteudo={
          '## Resumo\n\nObra **adiantada** e *sem* atrasos.\n\n- Fundação\n- Laje\n\n1. Pintar\n2. Entregar\n\n### Próximos'
        }
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Próximos' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('adiantada');
    expect(container.querySelector('em')).toHaveTextContent('sem');
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(container.querySelector('ul')).toHaveTextContent('Fundação Laje');
    expect(container.querySelector('ol')).toHaveTextContent('Pintar Entregar');
  });

  it('nunca gera h1: "#" vira h2 e "####" vira h3', () => {
    const { container } = render(<MarkdownTexto conteudo={'# Grande\n\n#### Pequeno'} />);

    expect(container.querySelector('h1')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Grande' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Pequeno' })).toBeInTheDocument();
  });

  it('texto antigo sem marcação aparece igual, com as quebras de linha simples preservadas', () => {
    const { container } = render(<MarkdownTexto conteudo={'Linha 1\nLinha 2\n\nOutro parágrafo'} />);

    const paragrafos = container.querySelectorAll('p');
    expect(paragrafos).toHaveLength(2);
    // O texto fica com o "\n" (o CSS `whitespace-pre-line` o mostra como quebra).
    expect(paragrafos[0]?.textContent).toBe('Linha 1\nLinha 2');
    expect(paragrafos[1]?.textContent).toBe('Outro parágrafo');
  });

  it('não monta script, HTML cru, link nem imagem: tudo vira texto ou some', () => {
    const conteudo = [
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(2)">',
      '<b onclick="x()">cru</b>',
      '[clique](javascript:alert(3))',
      '[site](https://exemplo.com)',
      '![foto](https://exemplo.com/a.png)',
      '<a href="https://exemplo.com">html</a>',
      '`codigo`',
      '> citação',
      '| a | b |\n|---|---|\n| 1 | 2 |',
    ].join('\n\n');
    const { container } = render(<MarkdownTexto conteudo={conteudo} />);

    for (const tag of ['script', 'img', 'a', 'b', 'code', 'pre', 'blockquote', 'table', 'iframe']) {
      expect(container.querySelector(tag), tag).toBeNull();
    }
    expect(container.querySelector('[onerror], [onclick], [href], [src]')).toBeNull();
    // O texto do link continua legível, sem o endereço virar link.
    expect(container).toHaveTextContent('clique');
    expect(container).toHaveTextContent('site');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // O HTML cru aparece como texto, não como elemento.
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });

  it('linha longa sem espaço é renderizada inteira', () => {
    const longo = 'x'.repeat(20000);
    const { container } = render(<MarkdownTexto conteudo={longo} />);

    expect(container.textContent).toContain(longo);
  });
});
