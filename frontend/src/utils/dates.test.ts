import { describe, expect, it } from 'vitest'
import {
  dayFractionOfMonth,
  formatDateOnly,
  formatMonthYearShort,
  formatMonthYearTitle,
  monthIndex,
  monthIndexToDateOnly,
  monthPosition,
  parseDateOnly,
  toDateOnly,
} from './dates'

describe('dates', () => {
  it('mantem o dia local (sem deslocar por fuso)', () => {
    const date = parseDateOnly('2026-10-13')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 13])
  })

  it('ida e volta preserva a data', () => {
    expect(toDateOnly(parseDateOnly('2026-01-05'))).toBe('2026-01-05')
  })

  it('formata em pt-BR', () => {
    expect(formatDateOnly('2026-10-13')).toBe('13/10/2026')
  })

  it('rejeita data invalida', () => {
    expect(() => parseDateOnly('abc')).toThrow()
  })

  it('titulo do mes: so a primeira letra maiuscula ("de" continua minusculo)', () => {
    expect(formatMonthYearTitle('2026-09-01')).toBe('Setembro de 2026')
  })

  it('mes curto: "Mar/26", sem deslocar por fuso no dia 1 e no ultimo dia', () => {
    expect(formatMonthYearShort('2026-03-01')).toBe('Mar/26')
    expect(formatMonthYearShort('2026-12-31')).toBe('Dez/26')
    expect(formatMonthYearShort('2027-01-01')).toBe('Jan/27')
  })

  it('indice de mes cruza a virada do ano e volta para a data', () => {
    expect(monthIndex('2027-01-15') - monthIndex('2026-12-01')).toBe(1)
    expect(monthIndexToDateOnly(monthIndex('2026-02-20'))).toBe('2026-02-01')
    expect(monthIndexToDateOnly(monthIndex('2026-12-20'))).toBe('2026-12-01')
  })

  it('posicao no mes: dia 1 = inicio, meio do mes = metade; data final ocupa o proprio dia', () => {
    expect(monthPosition('2026-04-01')).toBe(monthIndex('2026-04-01'))
    expect(monthPosition('2026-04-16')).toBeCloseTo(monthIndex('2026-04-01') + 15 / 30)
    expect(monthPosition('2026-02-15') + dayFractionOfMonth('2026-02-15')).toBeCloseTo(monthIndex('2026-02-01') + 15 / 28)
  })
})
