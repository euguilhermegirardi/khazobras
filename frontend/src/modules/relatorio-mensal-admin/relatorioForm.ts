import { z } from 'zod';
import type { RelatorioMensalAdmin, RelatorioMensalRequest } from '@/interfaces/relatorioMensal';
import { toDateOnly } from '@/utils/dates';
import { CONTEUDO_MAX_LENGTH } from './constants';

/**
 * Formulário do relatório ao cliente (novo e editar rascunho). Campos como texto; a conversão fica em
 * `toRelatorioBody`. Regras espelham `Create/UpdateRelatorioMensalRequestValidator`: competência entre os anos 2000 e
 * 2100; conteúdo obrigatório (sem ser só espaços), ≤ 20000 caracteres, sem controle (menos `\n \r \t`) nem direção do texto.
 */
export interface RelatorioFormValues {
  /** `yyyy-MM` do `<input type="month">`. */
  competencia: string;
  conteudo: string;
}

export type RelatorioCampo = keyof RelatorioFormValues;

const ANO_MIN = 2000;
const ANO_MAX = 2100;
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
// Controle C0/C1 (menos \t \n \r) e DEL; direção do texto U+202A–202E e U+2066–2069 (RelatorioMensalRegras).
// oxlint-disable-next-line no-control-regex -- a regra do backend recusa justamente estes caracteres
const CARACTERE_INVALIDO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/;

/** `true` se o texto tem controle ou caractere de direção do texto que o backend recusa. */
export function temCaractereInvalido(texto: string): boolean {
  return CARACTERE_INVALIDO.test(texto);
}

export const relatorioFormSchema = z.object({ competencia: z.string(), conteudo: z.string() }).superRefine((v, ctx) => {
  const erro = (campo: RelatorioCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

  const mes = v.competencia.trim();
  if (mes === '') erro('competencia', 'Informe o mês do relatório.');
  else if (!MES.test(mes)) erro('competencia', 'Informe um mês válido.');
  else if (Number(mes.slice(0, 4)) < ANO_MIN || Number(mes.slice(0, 4)) > ANO_MAX) {
    erro('competencia', `O ano deve estar entre ${ANO_MIN} e ${ANO_MAX}.`);
  }

  if (v.conteudo.trim() === '') erro('conteudo', 'Escreva o conteúdo do relatório.');
  else if (v.conteudo.length > CONTEUDO_MAX_LENGTH) {
    erro('conteudo', `O conteúdo aceita no máximo ${CONTEUDO_MAX_LENGTH} caracteres.`);
  } else if (temCaractereInvalido(v.conteudo)) {
    erro('conteudo', 'O conteúdo não pode ter caracteres de controle nem de direção do texto.');
  }
});

/** Relatório novo: competência = mês de hoje, conteúdo vazio. */
export function relatorioFormDefaults(hoje: Date): RelatorioFormValues {
  return { competencia: toDateOnly(hoje).slice(0, 7), conteudo: '' };
}

/** Editar: valores atuais (competência `yyyy-MM`). */
export function relatorioFormFrom(
  relatorio: Pick<RelatorioMensalAdmin, 'competencia' | 'conteudo'>,
): RelatorioFormValues {
  return { competencia: relatorio.competencia.slice(0, 7), conteudo: relatorio.conteudo };
}

/** Chave do servidor (minúscula) -> campo do formulário. `obraId` e o resto caem nos erros gerais. */
export const RELATORIO_CAMPOS_SERVIDOR: Record<string, RelatorioCampo> = {
  competencia: 'competencia',
  conteudo: 'conteudo',
};

/** Corpo do PUT (o POST acrescenta `obraId`). A competência vai como dia 1; o conteúdo vai como foi digitado. */
export function toRelatorioBody(v: RelatorioFormValues): RelatorioMensalRequest {
  return { competencia: `${v.competencia.trim()}-01`, conteudo: v.conteudo };
}

/** `yyyy-MM` -> `yyyy-MM-01` para a pré-visualização; `null` se o mês ainda não é válido. */
export function competenciaDoMes(mes: string): string | null {
  return MES.test(mes.trim()) ? `${mes.trim()}-01` : null;
}

/** "1234/20000" para o contador do textarea. */
export function contadorConteudo(texto: string): string {
  return `${texto.length}/${CONTEUDO_MAX_LENGTH}`;
}
