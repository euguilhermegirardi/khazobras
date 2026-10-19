import { describe, expect, it } from 'vitest';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { monthIndex } from '@/utils/dates';
import { barBox, buildRange, countByStatus, statusInfo, todayLeft } from './timeline';

const etapa = (parcial: Partial<EtapaCronograma>): EtapaCronograma => ({
  id: 'e1',
  obraId: 'o1',
  nome: 'Etapa',
  ordem: 1,
  percentualPeso: 10,
  dataInicioPrevista: null,
  dataInicioReal: null,
  dataFimPrevista: null,
  dataFimReal: null,
  status: 'nao_iniciada',
  createdAt: '2026-01-01T00:00:00Z',
  ...parcial,
});

const jan = monthIndex('2026-01-01');
const range3 = { firstMonth: jan, months: 3 }; // jan, fev, mar de 2026

describe('buildRange', () => {
  it('sem nenhuma data usa só o mês de hoje', () => {
    expect(buildRange([etapa({})], '2026-05-17')).toEqual({ firstMonth: monthIndex('2026-05-01'), months: 1 });
    expect(buildRange([], '2026-05-17')).toEqual({ firstMonth: monthIndex('2026-05-01'), months: 1 });
  });

  it('vai do mês da menor ao mês da maior data, considerando datas reais', () => {
    const range = buildRange(
      [
        etapa({ dataInicioPrevista: '2026-02-10', dataFimPrevista: '2026-03-01' }),
        etapa({ dataInicioReal: '2026-01-31', dataFimReal: '2026-04-01' }),
      ],
      '2026-02-15',
    );
    expect(range).toEqual({ firstMonth: jan, months: 4 });
  });

  it('atravessa a virada de ano', () => {
    const range = buildRange(
      [etapa({ dataInicioPrevista: '2025-11-30', dataFimPrevista: '2026-02-01' })],
      '2026-01-01',
    );
    expect(range.months).toBe(4);
  });
});

describe('barBox', () => {
  it('período no início do intervalo começa em 0% e a data final conta como dia inteiro', () => {
    const box = barBox('2026-01-01', '2026-01-31', range3);
    expect(box.left).toBe(0);
    expect(box.width).toBeCloseTo(100 / 3, 5);
  });

  it('cobrindo todo o intervalo vai de 0% a 100%', () => {
    const box = barBox('2026-01-01', '2026-03-31', range3);
    expect(box.left).toBe(0);
    expect(box.left + box.width).toBeCloseTo(100, 5);
  });

  it('período no fim do intervalo termina em 100%', () => {
    const box = barBox('2026-03-01', '2026-03-31', range3);
    expect(box.left).toBeCloseTo(200 / 3, 5);
    expect(box.left + box.width).toBeCloseTo(100, 5);
  });

  it('início e fim no mesmo dia ocupa um dia inteiro (fevereiro: 1/28 de mês)', () => {
    const box = barBox('2026-02-01', '2026-02-01', range3);
    expect(box.left).toBeCloseTo(100 / 3, 5);
    expect(box.width).toBeCloseTo(100 / 28 / 3, 5);
  });

  it('aplica a largura mínima em períodos muito curtos', () => {
    const range = { firstMonth: jan, months: 36 };
    const box = barBox('2026-02-10', '2026-02-10', range);
    expect(box.width).toBe(0.6);
  });

  it('não altera a largura quando já é maior que o mínimo', () => {
    const box = barBox('2026-01-01', '2026-02-28', range3);
    expect(box.width).toBeGreaterThan(0.6);
    expect(box.width).toBeCloseTo(200 / 3, 5);
  });
});

describe('todayLeft', () => {
  it('devolve null para hoje antes do primeiro mês ou depois do último', () => {
    expect(todayLeft('2025-12-31', range3)).toBeNull();
    expect(todayLeft('2026-04-01', range3)).toBeNull();
  });

  it('devolve posição em % dentro da grade no primeiro e no último dia do intervalo', () => {
    const inicio = todayLeft('2026-01-01', range3);
    const fim = todayLeft('2026-03-31', range3);
    expect(inicio).not.toBeNull();
    expect(fim).not.toBeNull();
    expect(inicio ?? -1).toBeGreaterThanOrEqual(0);
    expect(inicio ?? -1).toBeLessThan(2);
    expect(fim ?? -1).toBeGreaterThan(98);
    expect(fim ?? 101).toBeLessThanOrEqual(100);
  });

  it('posiciona no meio do dia (16/02: 1 mês + 15/28 + metade de um dia)', () => {
    const esperado = ((1 + 15 / 28 + 1 / 28 / 2) / 3) * 100;
    expect(todayLeft('2026-02-16', range3)).toBeCloseTo(esperado, 5);
  });

  it('funciona com grade de um único mês', () => {
    const left = todayLeft('2026-05-17', { firstMonth: monthIndex('2026-05-01'), months: 1 });
    expect(left).toBeCloseTo((16 / 31 + 1 / 31 / 2) * 100, 5);
  });
});

describe('statusInfo e countByStatus', () => {
  it('status conhecido tem rótulo; desconhecido cai em neutro com o texto cru', () => {
    expect(statusInfo('concluida')).toEqual({ label: 'Concluída', tone: 'success' });
    expect(statusInfo('xyz')).toEqual({ label: 'xyz', tone: 'neutral' });
  });

  it('conta por status', () => {
    const contagem = countByStatus([
      etapa({ status: 'concluida' }),
      etapa({ status: 'em_andamento' }),
      etapa({ status: 'em_andamento' }),
      etapa({ status: 'nao_iniciada' }),
    ]);
    expect(contagem).toEqual({ total: 4, concluidas: 1, emAndamento: 2, naoIniciadas: 1 });
  });
});
