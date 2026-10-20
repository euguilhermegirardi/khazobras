/** Os três números que o cliente e o admin veem de um contrato. */
export interface ValoresContrato {
  valorContratado: number;
  totalPago: number;
  saldoAPagar: number;
}

function toCents(valor: number): number {
  return Math.round(valor * 100);
}

function somarCampo(contratos: ValoresContrato[], campo: keyof ValoresContrato): number {
  return contratos.reduce((total, contrato) => total + toCents(contrato[campo]), 0) / 100;
}

/** Soma entre contratos, só para exibir (em centavos inteiros, sem erro de ponto flutuante). O backend segue sendo a fonte. */
export function somarContratos(contratos: ValoresContrato[]): ValoresContrato {
  return {
    valorContratado: somarCampo(contratos, 'valorContratado'),
    totalPago: somarCampo(contratos, 'totalPago'),
    saldoAPagar: somarCampo(contratos, 'saldoAPagar'),
  };
}

/** Saldo negativo = o cliente pagou além do contratado: rótulo "Pago a mais" e valor sem sinal. */
export function saldoExibicao(saldoAPagar: number): { label: string; valor: number; aMais: boolean } {
  if (saldoAPagar < 0) return { label: 'Pago a mais', valor: Math.abs(saldoAPagar), aMais: true };
  return { label: 'Saldo a pagar', valor: saldoAPagar, aMais: false };
}

/**
 * Percentual pago (0 a 100) para a barra. Só marca 100% quando o saldo está quitado: antes disso, nunca passa de
 * 99 (arredondar 99,6% para 100% faria a barra parecer quitada com saldo em aberto).
 */
export function percentualPago({ valorContratado, totalPago, saldoAPagar }: ValoresContrato): number {
  if (saldoAPagar <= 0) return 100;
  if (valorContratado <= 0 || totalPago <= 0) return 0;
  return Math.min(99, Math.floor((totalPago / valorContratado) * 100));
}
