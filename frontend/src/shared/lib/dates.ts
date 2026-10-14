/**
 * O backend manda DATE como "yyyy-MM-dd". `new Date("2026-10-13")` interpreta como UTC e, em
 * America/Sao_Paulo (UTC-3), mostraria o dia anterior. Aqui a data e tratada como data local.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) throw new Error(`Data inválida: ${value}`)
  return new Date(year, month - 1, day)
}

export function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(parseDateOnly(value))
}

/** Para enviar ao backend: "yyyy-MM-dd" da data local. */
export function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
