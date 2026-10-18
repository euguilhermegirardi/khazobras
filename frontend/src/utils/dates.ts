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

/** "junho de 2025" a partir de um DATE "yyyy-MM-dd" (competência de uma medição). */
export function formatMonthYear(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(parseDateOnly(value))
}

/** "Junho de 2025": mesmo formato, só a primeira letra maiúscula (para títulos). */
export function formatMonthYearTitle(value: string): string {
  const texto = formatMonthYear(value)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Data (dd/MM/aaaa) de um instante com fuso (TIMESTAMPTZ, ISO 8601), no fuso do navegador. */
export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}
