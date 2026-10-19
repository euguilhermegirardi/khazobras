import { formatDateOnly } from '@/utils/dates';

/** "01/03/2026 a 15/04/2026"; com uma data só, "Desde …" / "Até …"; sem datas, "—". */
export function formatPeriodo(inicio: string | null, fim: string | null): string {
  if (inicio && fim) return `${formatDateOnly(inicio)} a ${formatDateOnly(fim)}`;
  if (inicio) return `Desde ${formatDateOnly(inicio)}`;
  if (fim) return `Até ${formatDateOnly(fim)}`;
  return '—';
}
