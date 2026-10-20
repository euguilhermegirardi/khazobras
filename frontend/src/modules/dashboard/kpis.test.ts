import { describe, expect, it } from 'vitest';
import { prazoView, restanteView, SEM_PRAZO } from './kpis';

const sp = (texto: string) => texto.replace(/ /g, ' ');

describe('prazoView', () => {
  it('prazo futuro: dias em verde com a data prevista', () => {
    expect(prazoView({ diasRestantes: 72, dataPrevisaoTermino: '2026-12-31' })).toEqual({
      value: '72 dias',
      tone: 'success',
      hint: 'Previsão: 31/12/2026',
      longo: false,
    });
  });

  it('singular e vence hoje', () => {
    expect(prazoView({ diasRestantes: 1, dataPrevisaoTermino: '2026-10-21' }).value).toBe('1 dia');
    const hoje = prazoView({ diasRestantes: 0, dataPrevisaoTermino: '2026-10-20' });
    expect(hoje.value).toBe('Vence hoje');
    expect(hoje.tone).toBe('warning');
  });

  it('negativo: vencido em danger', () => {
    const v = prazoView({ diasRestantes: -12, dataPrevisaoTermino: '2026-10-08' });
    expect(v.value).toBe('Prazo vencido há 12 dias');
    expect(v.tone).toBe('danger');
    expect(v.hint).toBe('Previsão era 08/10/2026');
    expect(prazoView({ diasRestantes: -1, dataPrevisaoTermino: null }).value).toBe('Prazo vencido há 1 dia');
  });

  it('sem data: sem prazo definido, neutro e sem dica', () => {
    expect(prazoView({ diasRestantes: null, dataPrevisaoTermino: null })).toEqual({
      value: SEM_PRAZO,
      tone: 'neutral',
      hint: null,
      longo: true,
    });
  });
});

describe('restanteView', () => {
  const base = { valorContratado: 100000, valorMedidoAcumulado: 0, totalPago: 0 };

  it('positivo: valor restante em âmbar, "de R$ contratado"', () => {
    const v = restanteView({ ...base, valorRestante: 50000 });
    expect(v.label).toBe('Valor restante');
    expect(sp(v.value)).toBe('R$ 50.000,00');
    expect(v.tone).toBe('warning');
    expect(sp(v.hint)).toBe('de R$ 100.000,00');
  });

  it('negativo: "Acima do contratado" sem sinal, em danger', () => {
    const v = restanteView({ ...base, valorRestante: -1500.5 });
    expect(v.label).toBe('Acima do contratado');
    expect(sp(v.value)).toBe('R$ 1.500,50');
    expect(v.value).not.toContain('-');
    expect(v.tone).toBe('danger');
  });

  it('zero: tudo medido, em verde', () => {
    expect(restanteView({ ...base, valorRestante: 0 }).tone).toBe('success');
  });
});
