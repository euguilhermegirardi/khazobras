import { describe, expect, it } from 'vitest';
import { formatDateTime } from './dates';

describe('formatDateTime', () => {
  it('mostra dd/mm/aaaa e hh:mm, sem vírgula (o fuso é o do navegador)', () => {
    expect(formatDateTime('2026-10-21T15:30:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('usa zeros à esquerda e o horário local do instante informado', () => {
    // Sem "Z": instante no fuso local, então o resultado não depende do fuso da máquina.
    expect(formatDateTime('2026-03-05T04:07:00')).toBe('05/03/2026 04:07');
    expect(formatDateTime('2026-12-31T23:59:00')).toBe('31/12/2026 23:59');
  });
});
