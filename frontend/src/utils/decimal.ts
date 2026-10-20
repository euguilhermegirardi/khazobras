/** Número com no máximo 2 casas, ponto ou vírgula (o servidor recusa mais de 2). */
const DECIMAL_2_CASAS = /^\d+(?:[.,]\d{1,2})?$/;

/** Texto -> número, só se for decimal não negativo com até 2 casas; senão null. */
export function parseDecimal(texto: string): number | null {
  const limpo = texto.trim();
  if (!DECIMAL_2_CASAS.test(limpo)) return null;
  return Number(limpo.replace(',', '.'));
}
