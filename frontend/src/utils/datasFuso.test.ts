import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateOnly, formatMonthYearTitle, formatTimestamp, isDataValida, toDateOnly } from './dates';

describe('isDataValida', () => {
  it('aceita datas reais, inclusive 29/02 de ano bissexto', () => {
    for (const texto of ['2026-09-10', '2024-02-29', '2000-02-29', '2026-12-31', '2026-01-01']) {
      expect(isDataValida(texto)).toBe(true);
    }
  });

  it('recusa dia inexistente, mês inválido e formato errado', () => {
    for (const texto of [
      '2026-02-31',
      '2023-02-29',
      '2100-02-29',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-09-00',
      '2026-9-1',
      '10/09/2026',
      '2026-09-10T00:00:00Z',
      '',
      'abc',
    ]) {
      expect(isDataValida(texto)).toBe(false);
    }
  });
});

describe('datas no fuso America/Sao_Paulo (UTC-3)', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('o fuso do teste é mesmo o de São Paulo (um "yyyy-MM-dd" ingênuo recuaria um dia)', () => {
    expect(new Date('2026-09-10').getDate()).toBe(9);
  });

  it('formatDateOnly mostra o mesmo dia, sem recuar', () => {
    expect(formatDateOnly('2026-09-10')).toBe('10/09/2026');
    expect(formatDateOnly('2026-10-01')).toBe('01/10/2026');
    expect(formatDateOnly('2026-01-01')).toBe('01/01/2026');
    expect(formatDateOnly('2026-12-31')).toBe('31/12/2026');
  });

  it('formatMonthYearTitle da competência (dia 1) fica no mês certo, com a inicial maiúscula e sem "De"', () => {
    expect(formatMonthYearTitle('2026-09-01')).toBe('Setembro de 2026');
    expect(formatMonthYearTitle('2026-10-01')).toBe('Outubro de 2026');
    expect(formatMonthYearTitle('2026-01-01')).toBe('Janeiro de 2026');
    expect(formatMonthYearTitle('2026-03-01')).toBe('Março de 2026');
  });

  it('toDateOnly devolve o dia local, não o do UTC (23h em SP já é o dia seguinte em UTC)', () => {
    expect(toDateOnly(new Date(2026, 8, 10, 23, 30))).toBe('2026-09-10');
    expect(toDateOnly(new Date(2026, 8, 10, 0, 5))).toBe('2026-09-10');
  });

  it('formatTimestamp usa o dia local do instante (ISO em UTC)', () => {
    expect(formatTimestamp('2026-09-10T15:05:00Z')).toBe('10/09/2026');
    // 01:30 UTC ainda é o dia anterior em São Paulo.
    expect(formatTimestamp('2026-09-11T01:30:00Z')).toBe('10/09/2026');
  });
});
