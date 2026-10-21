import { z } from 'zod';
import type { RelatorioFotografico, RelatorioFotograficoRequest } from '@/interfaces/relatorioFotografico';
import { toDateOnly } from '@/utils/dates';
import { TITULO_MAX_LENGTH } from './constants';

/**
 * Formulário do relatório fotográfico (novo e editar metadados). Campos como texto; a conversão fica em
 * `toRelatorioBody`. Regras espelham `Create/UpdateRelatorioFotograficoRequestValidator` (`RelatorioFotograficoRegras`):
 * tipo mensal|etapa, título obrigatório ≤ 150, competência opcional entre os anos 2000 e 2100. O backend **não** exige
 * etapa no tipo `etapa` nem competência no tipo `mensal`: a tela só sugere (`sugestoesDoFormulario`), nunca trava.
 */
export interface RelatorioFormValues {
  /** `mensal` | `etapa`. */
  tipo: string;
  /** Id da etapa; vazio = sem etapa. */
  etapaId: string;
  titulo: string;
  /** `yyyy-MM` do `<input type="month">`; vazio = sem competência. */
  competencia: string;
}

export type RelatorioCampo = keyof RelatorioFormValues;

const ANO_MIN = 2000;
const ANO_MAX = 2100;
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const relatorioFormSchema = z
  .object({ tipo: z.string(), etapaId: z.string(), titulo: z.string(), competencia: z.string() })
  .superRefine((v, ctx) => {
    const erro = (campo: RelatorioCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });

    if (v.tipo !== 'mensal' && v.tipo !== 'etapa') erro('tipo', 'Escolha o tipo do relatório.');

    const titulo = v.titulo.trim();
    if (titulo === '') erro('titulo', 'Informe o título do relatório.');
    else if (titulo.length > TITULO_MAX_LENGTH) {
      erro('titulo', `O título aceita no máximo ${TITULO_MAX_LENGTH} caracteres.`);
    }

    const mes = v.competencia.trim();
    if (mes !== '') {
      if (!MES.test(mes)) erro('competencia', 'Informe um mês válido.');
      else if (Number(mes.slice(0, 4)) < ANO_MIN || Number(mes.slice(0, 4)) > ANO_MAX) {
        erro('competencia', `O ano deve estar entre ${ANO_MIN} e ${ANO_MAX}.`);
      }
    }
  });

/** Relatório novo: tipo mensal, competência = mês de hoje, sem etapa e sem título (quem cria escolhe). */
export function relatorioFormDefaults(hoje: Date): RelatorioFormValues {
  return { tipo: 'mensal', etapaId: '', titulo: '', competencia: toDateOnly(hoje).slice(0, 7) };
}

/** Editar: valores atuais (competência `yyyy-MM`). */
export function relatorioFormFrom(relatorio: RelatorioFotografico): RelatorioFormValues {
  return {
    tipo: relatorio.tipo,
    etapaId: relatorio.etapaId ?? '',
    titulo: relatorio.titulo,
    competencia: relatorio.competencia ? relatorio.competencia.slice(0, 7) : '',
  };
}

/** Chave do servidor (minúscula) -> campo do formulário. `obraId` e o resto caem nos erros gerais. */
export const RELATORIO_CAMPOS_SERVIDOR: Record<string, RelatorioCampo> = {
  tipo: 'tipo',
  etapaid: 'etapaId',
  titulo: 'titulo',
  competencia: 'competencia',
};

/** Corpo do PUT (o POST acrescenta `obraId`). Só chamar com valores já validados pelo schema. */
export function toRelatorioBody(v: RelatorioFormValues): RelatorioFotograficoRequest {
  const competencia = v.competencia.trim();
  return {
    tipo: v.tipo as RelatorioFotograficoRequest['tipo'],
    etapaId: v.etapaId === '' ? null : v.etapaId,
    titulo: v.titulo.trim(),
    // O backend guarda a competência como o dia 1 do mês.
    competencia: competencia === '' ? null : `${competencia}-01`,
  };
}

/**
 * Dicas (não erros) para o tipo escolhido: o backend aceita relatório de etapa sem etapa e mensal sem competência,
 * mas aí o cliente vê só o título digitado. Texto vazio = nada a sugerir.
 */
export function sugestoesDoFormulario(v: Pick<RelatorioFormValues, 'tipo' | 'etapaId' | 'competencia'>): {
  etapa: string;
  competencia: string;
} {
  return {
    etapa:
      v.tipo === 'etapa' && v.etapaId === ''
        ? 'Recomendado no tipo Etapa: escolha a etapa; o cliente vê o nome dela como título.'
        : '',
    competencia:
      v.tipo === 'mensal' && v.competencia.trim() === ''
        ? 'Recomendado no tipo Mensal: informe o mês; o cliente vê “Mês de ano” como título.'
        : '',
  };
}
