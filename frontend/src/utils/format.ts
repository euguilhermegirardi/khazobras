const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Somente exibicao. Regra de negocio com dinheiro e calculada no backend (decimal). */
export function formatCurrency(value: number): string {
  return currency.format(value);
}

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** Quantidades (até 3 casas) para exibição. */
export function formatQuantity(value: number): string {
  return decimal.format(value);
}

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Percentual para exibição, até 2 casas: 80 → "80%", 12.5 → "12,5%". */
export function formatPercent(value: number): string {
  return `${percent.format(value)}%`;
}
