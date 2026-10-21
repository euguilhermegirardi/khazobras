import { z } from 'zod';
import type { ProjetoDocumento, ProjetoRequest } from '@/interfaces/projeto';
import { extensaoDe, PROJETO_NOME_MAX, PROJETO_TIPO_MAX, temBarraOuControle, temControle } from './projetoRegras';

/**
 * Formulário de edição de um documento (nome, tipo, etapa) e os campos do lote de upload (tipo, etapa). Regras
 * espelham o `PUT /projetos/{id}`: nome 1..255, sem barras nem controle e **com a extensão do arquivo** (sem diferenciar
 * maiúsculas); tipo ≤ 50 (vazio vira null); etapa da mesma obra (o servidor confere).
 */
export interface ProjetoFormValues {
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

/** `extensao` = a do arquivo do documento (minúscula, com ponto), que o novo nome precisa manter. */
export function projetoFormSchemaPara(extensao: string) {
  return z.object({ nome: z.string(), tipoDocumento: z.string(), etapaId: z.string() }).superRefine((v, ctx) => {
    const erro = (campo: ProjetoCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

    const nome = v.nome.trim();
    if (nome === '') erro('nome', 'Informe o nome do documento.');
    else if (nome.length > PROJETO_NOME_MAX) erro('nome', `O nome aceita no máximo ${PROJETO_NOME_MAX} caracteres.`);
    else if (temBarraOuControle(nome)) erro('nome', 'O nome não pode ter barras (/ ou \\) nem caracteres de controle.');
    else if (extensao !== '' && extensaoDe(nome) !== extensao) {
      erro('nome', `O nome deve terminar com a extensão do arquivo (${extensao}).`);
    }

    const tipo = validarTipoDocumento(v.tipoDocumento);
    if (tipo) erro('tipoDocumento', tipo);
  });
}

export function projetoFormFrom(projeto: ProjetoDocumento): ProjetoFormValues {
  return { nome: projeto.nome, tipoDocumento: projeto.tipoDocumento ?? '', etapaId: projeto.etapaId ?? '' };
}

/** Chave do servidor (minúscula) -> campo. O resto cai nos erros gerais. */
export const PROJETO_CAMPOS_SERVIDOR: Record<string, ProjetoCampo> = {
  nome: 'nome',
  tipodocumento: 'tipoDocumento',
  etapaid: 'etapaId',
};

/** Corpo do PUT: sempre os três campos (texto vazio vira `null`). Só chamar com valores já validados. */
export function toProjetoBody(v: ProjetoFormValues): ProjetoRequest {
  const tipo = v.tipoDocumento.trim();
  return {
    nome: v.nome.trim(),
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
