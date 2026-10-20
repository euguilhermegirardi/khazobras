import type { DashboardPrazo, DashboardValores } from '@/interfaces/dashboard';
import { formatDateOnly } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export const SEM_PRAZO = 'Sem prazo definido';

function dias(n: number): string {
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

/**
 * Card "Prazo restante". `longo` = texto (não número): o card o mostra em fonte menor para caber em 1280.
 * Negativo = atrasado (danger); 0 = vence hoje (warning); sem data = neutro.
 */
export function prazoView(prazo: DashboardPrazo): { value: string; tone: Tone; hint: string | null; longo: boolean } {
  const data = prazo.dataPrevisaoTermino;
  const restantes = prazo.diasRestantes;

  if (restantes === null) {
    return { value: SEM_PRAZO, tone: 'neutral', hint: null, longo: true };
  }
  if (restantes < 0) {
    return {
      value: `Prazo vencido há ${dias(Math.abs(restantes))}`,
      tone: 'danger',
      hint: data ? `Previsão era ${formatDateOnly(data)}` : null,
      longo: true,
    };
  }
  return {
    value: restantes === 0 ? 'Vence hoje' : dias(restantes),
    tone: restantes === 0 ? 'warning' : 'success',
    hint: data ? `Previsão: ${formatDateOnly(data)}` : null,
    longo: false,
  };
}

/**
 * Card "Valor restante". Negativo = o medido passou do contratado: o rótulo vira "Acima do contratado" e o valor sai
 * sem sinal, em danger (mesma regra do "Pago a mais" dos Contratos). O sinal vem pronto do backend.
 */
export function restanteView(valores: DashboardValores): { label: string; value: string; tone: Tone; hint: string } {
  const hint = `de ${formatCurrency(valores.valorContratado)}`;
  if (valores.valorRestante < 0) {
    return {
      label: 'Acima do contratado',
      value: formatCurrency(Math.abs(valores.valorRestante)),
      tone: 'danger',
      hint,
    };
  }
  return {
    label: 'Valor restante',
    value: formatCurrency(valores.valorRestante),
    tone: valores.valorRestante === 0 ? 'success' : 'warning',
    hint,
  };
}
