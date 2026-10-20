import { z } from 'zod';
import type { CreateContratoRequest } from '@/interfaces/contrato';
import { parseDecimal } from '@/utils/decimal';

/**
 * Formulário de novo contrato. Campos como texto (é o que os inputs entregam); a conversão fica em `toCreateContratoBody`.
 * Regras espelham `CreateContratoRequestValidator`: número obrigatório ≤ 50 sem caracteres de controle, valor > 0
 * (2 casas, cabe em NUMERIC(14,2)), data de assinatura opcional entre 2000 e 2100. Quem decide é o servidor.
 */
export interface ContratoFormValues {
  numero: string;
  /** Texto digitado: "125000,55" ou "125000.55". */
  valorContratado: string;
  /** `yyyy-MM-dd` do `<input type="date">`; vazio = sem data. */
  dataAssinatura: string;
}

export type ContratoCampo = keyof ContratoFormValues;

export const NUMERO_MAX_LENGTH = 50;
export const VALOR_MAX = 999_999_999_999.99;
const ANO_MIN = 2000;
const ANO_MAX = 2100;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` se o texto é uma data real "yyyy-MM-dd" (rejeita 2026-02-31). */
export function isDataValida(texto: string): boolean {
  const partes = DATA.exec(texto);
  if (!partes) return false;
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

export const contratoFormSchema = z
  .object({ numero: z.string(), valorContratado: z.string(), dataAssinatura: z.string() })
  .superRefine((v, ctx) => {
    const erro = (campo: ContratoCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

    const numero = v.numero.trim();
    if (numero === '') erro('numero', 'Informe o número do contrato.');
    else if (numero.length > NUMERO_MAX_LENGTH) {
      erro('numero', `O número do contrato aceita no máximo ${NUMERO_MAX_LENGTH} caracteres.`);
    } else if (/\p{Cc}/u.test(numero)) erro('numero', 'O número do contrato contém caracteres inválidos.');

    const valor = parseDecimal(v.valorContratado);
    if (valor === null) erro('valorContratado', 'Informe o valor contratado (até 2 casas decimais, ex.: 125000,55).');
    else if (valor <= 0) erro('valorContratado', 'O valor contratado deve ser maior que zero.');
    else if (valor > VALOR_MAX) erro('valorContratado', 'O valor contratado excede o limite permitido.');

    const data = v.dataAssinatura.trim();
    if (data !== '') {
      if (!isDataValida(data)) erro('dataAssinatura', 'Informe uma data válida.');
      else if (Number(data.slice(0, 4)) < ANO_MIN || Number(data.slice(0, 4)) > ANO_MAX) {
        erro('dataAssinatura', `O ano da assinatura deve estar entre ${ANO_MIN} e ${ANO_MAX}.`);
      }
    }
  });

export const contratoFormDefaults: ContratoFormValues = { numero: '', valorContratado: '', dataAssinatura: '' };

/** Chave do servidor (minúscula) -> campo do formulário. */
export const CONTRATO_CAMPOS_SERVIDOR: Record<string, ContratoCampo> = {
  numero: 'numero',
  valorcontratado: 'valorContratado',
  dataassinatura: 'dataAssinatura',
};

/** Corpo do `POST /contratos`. Só chamar com valores já validados pelo schema. */
export function toCreateContratoBody(obraId: string, v: ContratoFormValues): CreateContratoRequest {
  const data = v.dataAssinatura.trim();
  return {
    obraId,
    numero: v.numero.trim(),
    valorContratado: Number(parseDecimal(v.valorContratado)),
    dataAssinatura: data === '' ? null : data,
  };
}
