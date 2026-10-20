import type { DashboardMedidoMes, DashboardSerieMes } from '@/interfaces/dashboard';
import { formatMonthYearShort, monthIndex, monthIndexToDateOnly } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

/** Acima disso (10 anos) não completa os meses vazios: mantém só os meses que vieram da API. */
const MAX_MESES_COMPLETADOS = 120;

/**
 * Série do gráfico: a API devolve só os meses com medição aprovada; aqui completa os meses vazios entre o primeiro e o
 * último (valorMedido 0 e acumulado mantido), para a escala do eixo X não "pular" meses. Só exibição.
 */
export function completarMeses(items: DashboardMedidoMes[]): DashboardSerieMes[] {
  if (items.length === 0) return [];

  const porMes = new Map<number, DashboardMedidoMes>();
  for (const item of items) porMes.set(monthIndex(item.competencia), item);
  const indices = [...porMes.keys()].sort((a, b) => a - b);
  const primeiro = indices[0] ?? 0;
  const ultimo = indices[indices.length - 1] ?? primeiro;

  const meses = ultimo - primeiro + 1 > MAX_MESES_COMPLETADOS ? indices : range(primeiro, ultimo);

  let acumulado = 0;
  return meses.map((indice) => {
    const competencia = monthIndexToDateOnly(indice);
    const real = porMes.get(indice);
    if (real) acumulado = real.valorMedidoAcumulado;
    return {
      competencia,
      rotulo: formatMonthYearShort(competencia),
      valorMedido: real?.valorMedido ?? 0,
      valorMedidoAcumulado: acumulado,
    };
  });
}

function range(primeiro: number, ultimo: number): number[] {
  return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => primeiro + i);
}

const PASSOS = [1, 1.5, 2, 2.5, 3, 4, 5, 10] as const;

/**
 * Teto "redondo" do eixo Y (4 intervalos iguais): 366.386 → 400.000, para os rótulos saírem R$ 100 mil, 200 mil...
 * em vez de 95 mil, 190 mil. Sem dados positivos devolve 4 (eixo 0..4), só para não quebrar a escala.
 */
export function maximoDoEixo(serie: DashboardSerieMes[]): number {
  const maior = Math.max(0, ...serie.map((m) => Math.max(m.valorMedido, m.valorMedidoAcumulado)));
  if (maior <= 0) return 4;
  const potencia = 10 ** Math.floor(Math.log10(maior / 4));
  const passo = PASSOS.map((p) => p * potencia).find((p) => p * 4 >= maior) ?? 10 * potencia;
  return passo * 4;
}

/** Texto do `aria-label` do gráfico (leitor de tela): período e acumulado final. */
export function resumoDoGrafico(serie: DashboardSerieMes[]): string {
  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  if (!primeiro || !ultimo) return 'Sem medições aprovadas.';
  const periodo =
    primeiro.competencia === ultimo.competencia ? primeiro.rotulo : `${primeiro.rotulo} a ${ultimo.rotulo}`;
  return `Gráfico do custo acumulado por mês, de ${periodo}. Acumulado até ${ultimo.rotulo}: ${formatCurrency(ultimo.valorMedidoAcumulado)}.`;
}
