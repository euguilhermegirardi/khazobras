import { describe, expect, it } from 'vitest'
import { formatDateOnly, parseDateOnly, toDateOnly } from './dates'

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
})
