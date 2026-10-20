import { z } from 'zod';
import type { CreatePagamentoRequest } from '@/interfaces/contrato';
import { toDateOnly } from '@/utils/dates';
import { parseDecimal } from '@/utils/decimal';
import { isDataValida, VALOR_MAX } from './contratoForm';

/**
 * Formulário de pagamento. Campos como texto; a conversão fica em `toCreatePagamentoBody`. Regras espelham
 * `CreatePagamentoRequestValidator`: valor > 0 (2 casas), data de 2000 até hoje + 1 dia (o backend usa UTC; o dia a
 * mais cobre o fuso), forma opcional ≤ 50, medição opcional (o servidor confere obra e NF emitida).
 */
export interface PagamentoFormValues {
  valor: string;
  /** `yyyy-MM-dd` do `<input type="date">`. */
  dataPagamento: string;
  formaPagamento: string;
  /** Id da medição; vazio = sem medição. */
  referenteMedicaoId: string;
}

export type PagamentoCampo = keyof PagamentoFormValues;

export const FORMA_MAX_LENGTH = 50;
const ANO_MIN = 2000;

/** "yyyy-MM-dd" de amanhã (data local), o limite da data do pagamento. */
export function amanha(hoje: Date): string {
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  return toDateOnly(proximo);
}

export const pagamentoFormSchema = z
  .object({
    valor: z.string(),
    dataPagamento: z.string(),
    formaPagamento: z.string(),
    referenteMedicaoId: z.string(),
  })
  .superRefine((v, ctx) => {
    const erro = (campo: PagamentoCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

    const valor = parseDecimal(v.valor);
    if (valor === null) erro('valor', 'Informe o valor do pagamento (até 2 casas decimais, ex.: 2500,50).');
    else if (valor <= 0) erro('valor', 'O valor do pagamento deve ser maior que zero.');
    else if (valor > VALOR_MAX) erro('valor', 'O valor do pagamento excede o limite permitido.');

    const data = v.dataPagamento.trim();
    if (data === '') erro('dataPagamento', 'Informe a data do pagamento.');
    else if (!isDataValida(data)) erro('dataPagamento', 'Informe uma data válida.');
    else if (Number(data.slice(0, 4)) < ANO_MIN) erro('dataPagamento', `A data deve ser de ${ANO_MIN} em diante.`);
    // yyyy-MM-dd compara certo como texto.
    else if (data > amanha(new Date())) erro('dataPagamento', 'A data do pagamento não pode ser no futuro.');

    const forma = v.formaPagamento.trim();
    if (forma.length > FORMA_MAX_LENGTH) {
      erro('formaPagamento', `A forma de pagamento aceita no máximo ${FORMA_MAX_LENGTH} caracteres.`);
    } else if (/\p{Cc}/u.test(forma)) erro('formaPagamento', 'A forma de pagamento contém caracteres inválidos.');
  });

export function pagamentoFormDefaults(hoje: Date): PagamentoFormValues {
  return { valor: '', dataPagamento: toDateOnly(hoje), formaPagamento: '', referenteMedicaoId: '' };
}

/** Chave do servidor (minúscula) -> campo do formulário. */
export const PAGAMENTO_CAMPOS_SERVIDOR: Record<string, PagamentoCampo> = {
  valor: 'valor',
  datapagamento: 'dataPagamento',
  formapagamento: 'formaPagamento',
  referentemedicaoid: 'referenteMedicaoId',
};

/** Corpo do `POST /contratos/{id}/pagamentos`. Só chamar com valores já validados pelo schema. */
export function toCreatePagamentoBody(v: PagamentoFormValues): CreatePagamentoRequest {
  const forma = v.formaPagamento.trim();
  return {
    valor: Number(parseDecimal(v.valor)),
    dataPagamento: v.dataPagamento.trim(),
    formaPagamento: forma === '' ? null : forma,
    referenteMedicaoId: v.referenteMedicaoId === '' ? null : v.referenteMedicaoId,
  };
}
