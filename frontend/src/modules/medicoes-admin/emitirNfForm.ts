import { z } from 'zod';
import type { IssueInvoiceRequest } from '@/interfaces/medicao';

/** Espelha `IssueInvoiceRequestValidator`: obrigatório, até 50 caracteres, sem caracteres de controle. */
const NF_MAX = 50;

export const emitirNfSchema = z.object({ nfNumber: z.string() }).superRefine((v, ctx) => {
  const erro = (message: string) => ctx.addIssue({ code: 'custom', path: ['nfNumber'], message });
  const nf = v.nfNumber.trim();
  if (nf === '') erro('Informe o número da nota fiscal.');
  else if (nf.length > NF_MAX) erro(`O número da nota fiscal aceita no máximo ${NF_MAX} caracteres.`);
  else if (/\p{Cc}/u.test(nf)) erro('O número da nota fiscal contém caracteres inválidos.');
});

export type EmitirNfFormValues = z.infer<typeof emitirNfSchema>;

export const NF_MAX_LENGTH = NF_MAX;

export function toIssueInvoiceBody(v: EmitirNfFormValues): IssueInvoiceRequest {
  return { nfNumber: v.nfNumber.trim() };
}

/** `{ errors: { NfNumber: [msg] } }` do 400: `nfNumber` vai para o campo, o resto em `gerais`. */
export function mapNfServerErrors(fieldErrors: Record<string, string[]> | undefined): {
  nfNumber?: string;
  gerais: string[];
} {
  let nfNumber: string | undefined;
  const gerais: string[] = [];
  for (const [chave, mensagens] of Object.entries(fieldErrors ?? {})) {
    if (chave.toLowerCase() === 'nfnumber') nfNumber = mensagens.join(' ');
    else gerais.push(...mensagens);
  }
  return { nfNumber, gerais };
}
