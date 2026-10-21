/**
 * O backend manda DATE como "yyyy-MM-dd". `new Date("2026-10-13")` interpreta como UTC e, em
 * America/Sao_Paulo (UTC-3), mostraria o dia anterior. Aqui a data e tratada como data local.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Data inválida: ${value}`);
  return new Date(year, month - 1, day);
}

export function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(parseDateOnly(value));
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` se o texto é uma data real "yyyy-MM-dd" (rejeita 2026-02-31). */
export function isDataValida(texto: string): boolean {
  const partes = DATA_ISO.exec(texto);
  if (!partes) return false;
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

/** Para enviar ao backend: "yyyy-MM-dd" da data local. */
export function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "junho de 2025" a partir de um DATE "yyyy-MM-dd" (competência de uma medição). */
export function formatMonthYear(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(parseDateOnly(value));
}

/** "Junho de 2025": mesmo formato, só a primeira letra maiúscula (para títulos). */
export function formatMonthYearTitle(value: string): string {
  const texto = formatMonthYear(value);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

/** "Mar/26" a partir de um DATE "yyyy-MM-dd" (cabeçalho de linha do tempo). */
export function formatMonthYearShort(value: string): string {
  const date = parseDateOnly(value);
  return `${MESES_CURTOS[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
}

/** Número sequencial do mês (ano * 12 + mês 0-11): permite contar meses entre duas datas. */
export function monthIndex(value: string): number {
  const date = parseDateOnly(value);
  return date.getFullYear() * 12 + date.getMonth();
}

/** Primeiro dia ("yyyy-MM-dd") do mês de um `monthIndex`. */
export function monthIndexToDateOnly(index: number): string {
  const year = Math.floor(index / 12);
  const month = String((index % 12) + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Posição fracionária na linha do tempo, em meses: `monthIndex` + parte do mês já decorrida no início do dia.
 * Ex.: 1º de março = 2026*12+2; 16/03 (mês de 31 dias) = +15/31.
 */
export function monthPosition(value: string): number {
  const date = parseDateOnly(value);
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return monthIndex(value) + (date.getDate() - 1) / days;
}

/** Fração de mês ocupada por um dia (para tratar a data final como inclusiva). */
export function dayFractionOfMonth(value: string): number {
  const date = parseDateOnly(value);
  return 1 / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Data (dd/MM/aaaa) de um instante com fuso (TIMESTAMPTZ, ISO 8601), no fuso do navegador. */
export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

/** Data e hora (dd/MM/aaaa HH:mm) de um instante ISO 8601, no fuso do navegador (histórico de alterações). */
export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(value))
    .replace(',', '');
}
