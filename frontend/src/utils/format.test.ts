import { describe, expect, it } from 'vitest';
import { formatCurrency, formatCurrencyCompact, formatPercent } from './format';

// O Intl usa espaço sem quebra (U+00A0) entre "R$" e o número.
const sp = (texto: string) => texto.replace(/\s/g, ' ');

// O formato compacto depende da versão do ICU: o Node 22 (ICU 77) devolve "R$ 100,0 mil", o Chromium "R$ 100 mil".
// Por isso a casa decimal ",0" é opcional aqui; o rótulo exato no navegador real é conferido no e2e (dashboard.e2e.ts).
describe('formatCurrencyCompact (eixo do gráfico)', () => {
  it('zero', () => {
    expect(sp(formatCurrencyCompact(0))).toMatch(/^R\$ 0(,0)?$/);
  });

  it('milhares: "R$ 50 mil"', () => {
    expect(sp(formatCurrencyCompact(50000))).toMatch(/^R\$ 50(,0)? mil$/);
    expect(sp(formatCurrencyCompact(100000))).toMatch(/^R\$ 100(,0)? mil$/);
    expect(sp(formatCurrencyCompact(400000))).toMatch(/^R\$ 400(,0)? mil$/);
  });

  it('milhões com uma casa: "R$ 1,3 mi"', () => {
    expect(sp(formatCurrencyCompact(1250000))).toBe('R$ 1,3 mi');
    expect(sp(formatCurrencyCompact(1600000))).toBe('R$ 1,6 mi');
  });

  it('centenas ficam sem sufixo e sem centavos', () => {
    expect(sp(formatCurrencyCompact(750))).toMatch(/^R\$ 750(,0)?$/);
  });
});

describe('formatCurrency / formatPercent', () => {
  it('moeda completa em pt-BR', () => {
    expect(sp(formatCurrency(366386.55))).toBe('R$ 366.386,55');
  });

  it('percentual com até 2 casas', () => {
    expect(formatPercent(58.5)).toBe('58,5%');
    expect(formatPercent(100)).toBe('100%');
  });
});
