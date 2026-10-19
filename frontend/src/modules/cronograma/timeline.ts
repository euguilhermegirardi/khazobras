import type { EtapaCronograma } from '@/interfaces/etapa';
import { dayFractionOfMonth, monthIndex, monthPosition } from '@/utils/dates';
import { ETAPA_STATUS, type EtapaTone, STATUS_CONCLUIDA, STATUS_EM_ANDAMENTO, STATUS_NAO_INICIADA } from './constants';

/** Largura mínima de uma barra (% da grade), para etapas de poucos dias continuarem visíveis. */
const MIN_BAR_WIDTH = 0.6;

export interface TimelineRange {
  /** `monthIndex` do primeiro mês da grade. */
  firstMonth: number;
  months: number;
}

export interface BarBox {
  left: number;
  width: number;
}

export function statusInfo(status: string): { label: string; tone: EtapaTone } {
  return ETAPA_STATUS[status] ?? { label: status, tone: 'neutral' };
}

export function countByStatus(etapas: EtapaCronograma[]) {
  const count = (status: string) => etapas.filter((etapa) => etapa.status === status).length;
  return {
    total: etapas.length,
    concluidas: count(STATUS_CONCLUIDA),
    emAndamento: count(STATUS_EM_ANDAMENTO),
    naoIniciadas: count(STATUS_NAO_INICIADA),
  };
}

/** Do mês da menor data ao mês da maior (previstas e reais). Sem nenhuma data: só o mês de hoje. */
export function buildRange(etapas: EtapaCronograma[], hoje: string): TimelineRange {
  const meses = etapas
    .flatMap((etapa) => [etapa.dataInicioPrevista, etapa.dataFimPrevista, etapa.dataInicioReal, etapa.dataFimReal])
    .filter((data): data is string => data !== null)
    .map(monthIndex);
  if (meses.length === 0) return { firstMonth: monthIndex(hoje), months: 1 };
  const firstMonth = Math.min(...meses);
  return { firstMonth, months: Math.max(...meses) - firstMonth + 1 };
}

/** Posição e largura (% da grade) de um período; a data final conta como dia inteiro. */
export function barBox(inicio: string, fim: string, range: TimelineRange): BarBox {
  const left = ((monthPosition(inicio) - range.firstMonth) / range.months) * 100;
  const right = ((monthPosition(fim) + dayFractionOfMonth(fim) - range.firstMonth) / range.months) * 100;
  return { left, width: Math.max(right - left, MIN_BAR_WIDTH) };
}

/** Posição (% da grade) do marcador de hoje, ou null se hoje está fora da grade. */
export function todayLeft(hoje: string, range: TimelineRange): number | null {
  const mes = monthIndex(hoje);
  if (mes < range.firstMonth || mes >= range.firstMonth + range.months) return null;
  return ((monthPosition(hoje) - range.firstMonth + dayFractionOfMonth(hoje) / 2) / range.months) * 100;
}
