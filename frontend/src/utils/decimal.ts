/** Número com no máximo 2 casas, ponto ou vírgula (o servidor recusa mais de 2). */
const DECIMAL_2_CASAS = /^\d+(?:[.,]\d{1,2})?$/;

/** Maior valor de uma coluna NUMERIC(14,2) (validators de Medições, Contratos e Financeiro). */
export const VALOR_MAX = 999_999_999_999.99;

/** Texto -> número, só se for decimal não negativo com até 2 casas; senão null. */
export function parseDecimal(texto: string): number | null {
  const limpo = texto.trim();
  if (!DECIMAL_2_CASAS.test(limpo)) return null;
  return Number(limpo.replace(',', '.'));
}
