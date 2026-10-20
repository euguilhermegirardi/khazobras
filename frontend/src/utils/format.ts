const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Somente exibicao. Regra de negocio com dinheiro e calculada no backend (decimal). */
export function formatCurrency(value: number): string {
  return currency.format(value);
}

const currencyCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Eixo de gráfico: 50000 → "R$ 50 mil", 1250000 → "R$ 1,3 mi". Só exibição. */
export function formatCurrencyCompact(value: number): string {
  return currencyCompact.format(value);
}

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** Quantidades (até 3 casas) para exibição. */
export function formatQuantity(value: number): string {
  return decimal.format(value);
}

const kbMb = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Tamanho de arquivo: 512 → "512 B", 10240 → "10 KB", 1572864 → "1,5 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${kbMb.format(bytes / 1024)} KB`;
  return `${kbMb.format(bytes / (1024 * 1024))} MB`;
}

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Percentual para exibição, até 2 casas: 80 → "80%", 12.5 → "12,5%". */
export function formatPercent(value: number): string {
  return `${percent.format(value)}%`;
}
