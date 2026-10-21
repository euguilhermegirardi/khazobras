import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RelatorioMensalCard } from './RelatorioMensalCard';

const base = { competencia: '2026-09-01', conteudo: 'Texto', publishedAt: '2026-10-02T12:00:00Z' };

describe('RelatorioMensalCard', () => {
  it('mostra o mês em título (sem "De" maiúsculo) e a data de publicação', () => {
    render(<RelatorioMensalCard relatorio={base} />);

    expect(screen.getByText('Setembro de 2026')).toBeInTheDocument();
    expect(screen.getByText('Publicado em 02/10/2026')).toBeInTheDocument();
  });

  it('sem data de publicação (prévia do rascunho) não mostra "Publicado em"', () => {
    render(<RelatorioMensalCard relatorio={{ ...base, publishedAt: null }} />);

    expect(screen.queryByText(/Publicado em/)).not.toBeInTheDocument();
  });

  it('preserva quebras de linha e espaços do texto, sem interpretar HTML', () => {
    const conteudo = 'Linha 1\n\n  Linha 3 com recuo\n<b>não é negrito</b>';
    const { container } = render(<RelatorioMensalCard relatorio={{ ...base, conteudo }} />);

    // Sem normalizar espaços: o texto no DOM é exatamente o que veio da API.
    expect(screen.getByText(conteudo, { normalizer: (texto) => texto })).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('texto de uma linha só, sem espaços, é renderizado inteiro (a quebra é do CSS)', () => {
    const longo = 'x'.repeat(20000);
    const { container } = render(<RelatorioMensalCard relatorio={{ ...base, conteudo: longo }} />);

    expect(container.textContent).toContain(longo);
  });
});
