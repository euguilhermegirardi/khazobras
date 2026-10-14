const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Somente exibicao. Regra de negocio com dinheiro e calculada no backend (decimal). */
export function formatCurrency(value: number): string {
  return currency.format(value)
}
