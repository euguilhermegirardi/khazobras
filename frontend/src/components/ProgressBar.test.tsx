import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('mostra o rótulo (truncado, com title), o % e a barra com nome acessível', () => {
    render(<ProgressBar label="Estrutura (Lajes e Vigas)" value={42.4} />);

    const rotulo = screen.getByTitle('Estrutura (Lajes e Vigas)');
    expect(rotulo).toHaveTextContent('Estrutura (Lajes e Vigas)');
    expect(rotulo).toHaveClass('truncate');
    expect(screen.getByText('42%')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Estrutura (Lajes e Vigas)' });
    expect(barra).toHaveAttribute('aria-valuenow', '42');
    expect(barra).toHaveAttribute('aria-valuemin', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '100');
  });

  it('o rótulo visível aparece uma vez só como texto', () => {
    render(<ProgressBar label="Fundações" value={10} />);

    expect(screen.getAllByText('Fundações')).toHaveLength(1);
  });

  it('hideLabel esconde o rótulo visual (sr-only, sem title) mas mantém o nome acessível', () => {
    render(<ProgressBar label="Fundações" value={10} hideLabel />);

    expect(screen.queryByTitle('Fundações')).not.toBeInTheDocument();
    expect(screen.getByText('Fundações')).toHaveClass('sr-only');
    expect(screen.getByRole('progressbar', { name: 'Fundações' })).toBeInTheDocument();
  });

  it('limita o valor entre 0 e 100', () => {
    const { rerender } = render(<ProgressBar label="A" value={250} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();

    rerender(<ProgressBar label="A" value={-3} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
