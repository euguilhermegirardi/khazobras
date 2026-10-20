import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  amanha,
  pagamentoFormDefaults,
  pagamentoFormSchema,
  type PagamentoFormValues,
  toCreatePagamentoBody,
} from './pagamentoForm';

const erros = (v: PagamentoFormValues) => {
  const r = pagamentoFormSchema.safeParse(v);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('pagamentoForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 19, 12, 0, 0)); // 19/10/2026 local
  });
  afterEach(() => vi.useRealTimers());

  const valido = pagamentoFormDefaults(new Date(2026, 9, 19)); // data padrão = hoje
  const base: PagamentoFormValues = { ...valido, valor: '2500,50' };

  it('o padrão é a data de hoje e amanhã é o limite', () => {
    expect(valido.dataPagamento).toBe('2026-10-19');
    expect(amanha(new Date(2026, 9, 31))).toBe('2026-11-01');
    expect(erros({ ...base, dataPagamento: '2026-10-20' })).toEqual({});
    expect(erros({ ...base, dataPagamento: '2026-10-21' }).dataPagamento).toBeDefined();
    expect(erros({ ...base, dataPagamento: '1999-12-31' }).dataPagamento).toBeDefined();
    expect(erros({ ...base, dataPagamento: '' }).dataPagamento).toBeDefined();
  });

  it('valor maior que zero com até 2 casas', () => {
    for (const valor of ['', '0', '-1', '1,234', 'x']) expect(erros({ ...base, valor }).valor).toBeDefined();
    expect(erros(base)).toEqual({});
  });

  it('forma opcional, até 50 caracteres', () => {
    expect(erros({ ...base, formaPagamento: 'x'.repeat(51) }).formaPagamento).toBeDefined();
    expect(erros({ ...base, formaPagamento: '  Pix  ' })).toEqual({});
  });

  it('o corpo usa null para forma e medição vazias', () => {
    expect(toCreatePagamentoBody({ ...base, formaPagamento: ' ', referenteMedicaoId: '' })).toEqual({
      valor: 2500.5,
      dataPagamento: '2026-10-19',
      formaPagamento: null,
      referenteMedicaoId: null,
    });
    expect(toCreatePagamentoBody({ ...base, formaPagamento: ' Pix ', referenteMedicaoId: 'm1' })).toMatchObject({
      formaPagamento: 'Pix',
      referenteMedicaoId: 'm1',
    });
  });
});
