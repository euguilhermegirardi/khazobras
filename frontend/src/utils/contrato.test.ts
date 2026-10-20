import { describe, expect, it } from 'vitest';
import { percentualPago, saldoExibicao, somarContratos } from './contrato';

describe('somarContratos', () => {
  it('soma os três valores sem erro de ponto flutuante', () => {
    const total = somarContratos([
      { valorContratado: 0.1, totalPago: 0.1, saldoAPagar: 0 },
      { valorContratado: 0.2, totalPago: 0.05, saldoAPagar: 0.15 },
    ]);
    expect(total).toEqual({ valorContratado: 0.3, totalPago: 0.15, saldoAPagar: 0.15 });
  });

  it('lista vazia soma zero', () => {
    expect(somarContratos([])).toEqual({ valorContratado: 0, totalPago: 0, saldoAPagar: 0 });
  });
});

describe('saldoExibicao', () => {
  it('saldo positivo ou zero é "Saldo a pagar"', () => {
    expect(saldoExibicao(150)).toEqual({ label: 'Saldo a pagar', valor: 150, aMais: false });
    expect(saldoExibicao(0)).toEqual({ label: 'Saldo a pagar', valor: 0, aMais: false });
  });

  it('saldo negativo vira "Pago a mais" sem sinal', () => {
    expect(saldoExibicao(-250.5)).toEqual({ label: 'Pago a mais', valor: 250.5, aMais: true });
  });
});

describe('percentualPago', () => {
  const valores = (valorContratado: number, totalPago: number) => ({
    valorContratado,
    totalPago,
    saldoAPagar: valorContratado - totalPago,
  });

  it('sem pagamento é 0 e quitado ou pago a mais é 100', () => {
    expect(percentualPago(valores(1000, 0))).toBe(0);
    expect(percentualPago(valores(1000, 1000))).toBe(100);
    expect(percentualPago(valores(1000, 1200))).toBe(100);
  });

  it('arredonda para baixo e nunca mostra 100 com saldo em aberto', () => {
    expect(percentualPago(valores(1000, 333))).toBe(33);
    expect(percentualPago(valores(1000, 999.9))).toBe(99);
  });
});
