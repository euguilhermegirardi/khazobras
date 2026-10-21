import { z } from 'zod';
import type { Foto, UpdateFotoRequest } from '@/interfaces/relatorioFotografico';
import { isDataValida, toDateOnly } from '@/utils/dates';
import { FOTO_DESCRICAO_MAX } from '@/utils/foto';

/**
 * Formulário de edição de uma foto (descrição e data). Regras espelham `FotoRegras.Erros`: descrição ≤ 255 (vazia vira
 * null), data opcional entre 2000-01-01 e amanhã. A ordem não é editada aqui (reordenar é pelas setas).
 */
export interface FotoFormValues {
  descricao: string;
  /** `yyyy-MM-dd` do `<input type="date">`; vazio = sem data. */
  dataFoto: string;
}

export type FotoCampo = keyof FotoFormValues;

const DATA_MINIMA = '2000-01-01';

/** Maior data aceita pelo backend: amanhã (cobre o fuso). `hoje` é injetado para testar. */
export function dataMaximaFoto(hoje: Date): string {
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  return toDateOnly(amanha);
}

export function fotoFormSchemaPara(hoje: Date) {
  const maxima = dataMaximaFoto(hoje);
  return z.object({ descricao: z.string(), dataFoto: z.string() }).superRefine((v, ctx) => {
    const erro = (campo: FotoCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

    if (v.descricao.trim().length > FOTO_DESCRICAO_MAX) {
      erro('descricao', `A descrição aceita no máximo ${FOTO_DESCRICAO_MAX} caracteres.`);
    }

    const data = v.dataFoto.trim();
    if (data !== '') {
      if (!isDataValida(data)) erro('dataFoto', 'Informe uma data válida.');
      else if (data < DATA_MINIMA || data > maxima) erro('dataFoto', 'A data deve estar entre 2000 e amanhã.');
    }
  });
}

export function fotoFormFrom(foto: Foto): FotoFormValues {
  return { descricao: foto.descricao ?? '', dataFoto: foto.dataFoto ?? '' };
}

/** Chave do servidor (minúscula) -> campo. `Ordem`/`Body` e o resto caem nos erros gerais. */
export const FOTO_CAMPOS_SERVIDOR: Record<string, FotoCampo> = {
  descricao: 'descricao',
  datafoto: 'dataFoto',
};

/**
 * Corpo do PATCH só com o que mudou (o backend é parcial: campo ausente mantém, `null` limpa). Texto vazio vira
 * `null`. Objeto vazio = nada mudou, não precisa chamar a API.
 */
export function toFotoPatch(v: FotoFormValues, foto: Foto): UpdateFotoRequest {
  const patch: UpdateFotoRequest = {};
  const descricao = v.descricao.trim() === '' ? null : v.descricao.trim();
  if (descricao !== (foto.descricao?.trim() || null)) patch.descricao = descricao;
  const data = v.dataFoto.trim() === '' ? null : v.dataFoto.trim();
  if (data !== (foto.dataFoto ?? null)) patch.dataFoto = data;
  return patch;
}

/** Metadados de um lote de upload (descrição e data iguais para todas as fotos do lote). */
export interface LoteValues {
  descricao: string;
  dataFoto: string;
}

/** Mesmas regras da edição, aplicadas aos campos do lote de upload; devolve mensagem por campo ({} = ok). */
export function validarLote(v: LoteValues, hoje: Date): Partial<Record<FotoCampo, string>> {
  const resultado = fotoFormSchemaPara(hoje).safeParse(v);
  if (resultado.success) return {};
  const erros: Partial<Record<FotoCampo, string>> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as FotoCampo;
    erros[campo] ??= issue.message;
  }
  return erros;
}
