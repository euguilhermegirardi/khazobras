import { z } from 'zod';
import type { ProjetoDocumento, ProjetoRequest } from '@/interfaces/projeto';
import { partirNome, PROJETO_NOME_MAX, PROJETO_TIPO_MAX, temBarraOuControle, temControle } from './projetoRegras';

/**
 * Formulário de edição de um documento (nome, tipo, etapa) e os campos do lote de upload (tipo, etapa). O campo `nome`
 * é só a **base** (sem a extensão, que nunca é editável: o servidor exige que o nome mantenha a extensão do arquivo e
 * o front a reanexa na caixa original). Regras: base não vazia, base + extensão ≤ 255, sem barras nem controle; tipo
 * ≤ 50 (vazio vira null); etapa da mesma obra (o servidor confere).
 */
export interface ProjetoFormValues {
  /** Nome sem a extensão. */
  nome: string;
  /** Vazio = sem tipo. */
  tipoDocumento: string;
  /** Id da etapa; vazio = sem etapa. */
  etapaId: string;
}

export type ProjetoCampo = keyof ProjetoFormValues;

/** Valores do lote de upload (sem nome: cada arquivo leva o seu). */
export type LoteValues = Pick<ProjetoFormValues, 'tipoDocumento' | 'etapaId'>;

/** Mensagem do tipo de documento ou null. Vale no formulário e no lote de upload. */
export function validarTipoDocumento(valor: string): string | null {
  const tipo = valor.trim();
  if (tipo.length > PROJETO_TIPO_MAX) return `O tipo do documento aceita no máximo ${PROJETO_TIPO_MAX} caracteres.`;
  if (temControle(tipo)) return 'O tipo do documento não pode ter caracteres de controle.';
  return null;
}

/** `extensao` = a do documento, na caixa original e com ponto: entra na conta do limite de 255 caracteres. */
export function projetoFormSchemaPara(extensao: string) {
  return z.object({ nome: z.string(), tipoDocumento: z.string(), etapaId: z.string() }).superRefine((v, ctx) => {
    const erro = (campo: ProjetoCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

    const base = v.nome.trim();
    if (base === '') erro('nome', 'Informe o nome do documento.');
    else if (base.length + extensao.length > PROJETO_NOME_MAX) {
      const complemento = extensao ? ` (a extensão ${extensao} já conta)` : '';
      erro('nome', `O nome aceita no máximo ${PROJETO_NOME_MAX - extensao.length} caracteres${complemento}.`);
    } else if (temBarraOuControle(base)) {
      erro('nome', 'O nome não pode ter barras (/ ou \\) nem caracteres de controle.');
    }

    const tipo = validarTipoDocumento(v.tipoDocumento);
    if (tipo) erro('tipoDocumento', tipo);
  });
}

export function projetoFormFrom(projeto: ProjetoDocumento): ProjetoFormValues {
  return {
    nome: partirNome(projeto.nome).base,
    tipoDocumento: projeto.tipoDocumento ?? '',
    etapaId: projeto.etapaId ?? '',
  };
}

/** Chave do servidor (minúscula) -> campo. O resto cai nos erros gerais. */
export const PROJETO_CAMPOS_SERVIDOR: Record<string, ProjetoCampo> = {
  nome: 'nome',
  tipodocumento: 'tipoDocumento',
  etapaid: 'etapaId',
};

/**
 * Corpo do PUT: sempre os três campos (texto vazio vira `null`); o nome é a base aparada + a extensão original do
 * documento (`partirNome(projeto.nome).extensao`). Base que já termina com a extensão é válida ("x.pdf.pdf"). Só
 * chamar com valores já validados.
 */
export function toProjetoBody(v: ProjetoFormValues, extensao: string): ProjetoRequest {
  const tipo = v.tipoDocumento.trim();
  return {
    nome: v.nome.trim() + extensao,
    tipoDocumento: tipo === '' ? null : tipo,
    etapaId: v.etapaId === '' ? null : v.etapaId,
  };
}

/** Nada mudou em relação ao documento salvo (não precisa chamar a API)? */
export function semMudancas(body: ProjetoRequest, projeto: ProjetoDocumento): boolean {
  return (
    body.nome === projeto.nome &&
    body.tipoDocumento === (projeto.tipoDocumento?.trim() || null) &&
    body.etapaId === projeto.etapaId
  );
}

/** Valida o tipo do lote de upload; devolve mensagem por campo ({} = ok). */
export function validarLote(v: LoteValues): Partial<Record<'tipoDocumento', string>> {
  const tipo = validarTipoDocumento(v.tipoDocumento);
  return tipo ? { tipoDocumento: tipo } : {};
}
