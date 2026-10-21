import { z } from 'zod';
import type { LancamentoAdmin, UpdateLancamentoRequest } from '@/interfaces/financeiroAdmin';
import { isDataValida, toDateOnly } from '@/utils/dates';
import { parseDecimal, VALOR_MAX } from '@/utils/decimal';
import { categoriaParaRequest } from '@/utils/lancamentoCategoria';
import { DESCRICAO_MAX_LENGTH } from './constants';

/**
 * Formulário de lançamento (novo e editar). Campos como texto; a conversão fica em `toLancamentoBody`. Regras
 * espelham `Create/UpdateFinanceiroLancamentoRequestValidator` (`LancamentoRegras`): categoria do enum, descrição
 * obrigatória ≤ 255, valor > 0 com até 2 casas e ≤ NUMERIC(14,2), datas entre os anos 2000 e 2100. Quem decide é o servidor.
 */
export interface LancamentoFormValues {
  /** `mao_de_obra` | `material` | `equipamento`; vazio = não escolhida. */
  categoria: string;
  descricao: string;
  /** Texto digitado: "1500,50" ou "1500.50". */
  valor: string;
  /** `yyyy-MM-dd` do `<input type="date">`. */
  dataLancamento: string;
  /** `yyyy-MM` do `<input type="month">`. */
  mesCompetencia: string;
  /** Padrão FALSO: o cliente só vê o que for liberado. */
  visivelCliente: boolean;
}

export type LancamentoCampo = keyof LancamentoFormValues;

const ANO_MIN = 2000;
const ANO_MAX = 2100;
const CATEGORIAS = ['mao_de_obra', 'material', 'equipamento'];
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `true` se o texto é um mês real "yyyy-MM". */
export function isMesValido(texto: string): boolean {
  return MES.test(texto);
}

export const lancamentoFormSchema = z
  .object({
    categoria: z.string(),
    descricao: z.string(),
    valor: z.string(),
    dataLancamento: z.string(),
    mesCompetencia: z.string(),
    visivelCliente: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const erro = (campo: LancamentoCampo, message: string) => ctx.addIssue({ code: 'custom', path: [campo], message });
    const anoForaDoLimite = (ano: number) => ano < ANO_MIN || ano > ANO_MAX;

    if (!CATEGORIAS.includes(v.categoria)) erro('categoria', 'Escolha a categoria.');

    const descricao = v.descricao.trim();
    if (descricao === '') erro('descricao', 'Informe a descrição do lançamento.');
    else if (descricao.length > DESCRICAO_MAX_LENGTH) {
      erro('descricao', `A descrição aceita no máximo ${DESCRICAO_MAX_LENGTH} caracteres.`);
    }

    const valor = parseDecimal(v.valor);
    if (valor === null) erro('valor', 'Informe o valor (até 2 casas decimais, ex.: 1500,50).');
    else if (valor <= 0) erro('valor', 'O valor deve ser maior que zero.');
    else if (valor > VALOR_MAX) erro('valor', 'O valor excede o limite permitido.');

    const data = v.dataLancamento.trim();
    if (data === '') erro('dataLancamento', 'Informe a data do lançamento.');
    else if (!isDataValida(data)) erro('dataLancamento', 'Informe uma data válida.');
    else if (anoForaDoLimite(Number(data.slice(0, 4)))) {
      erro('dataLancamento', `O ano deve estar entre ${ANO_MIN} e ${ANO_MAX}.`);
    }

    const mes = v.mesCompetencia.trim();
    if (mes === '') erro('mesCompetencia', 'Informe o mês de competência.');
    else if (!isMesValido(mes)) erro('mesCompetencia', 'Informe um mês válido.');
    else if (anoForaDoLimite(Number(mes.slice(0, 4)))) {
      erro('mesCompetencia', `O ano deve estar entre ${ANO_MIN} e ${ANO_MAX}.`);
    }
  });

/** Lançamento novo: data de hoje, competência = mês de hoje, categoria a escolher, oculto ao cliente. */
export function lancamentoFormDefaults(hoje: Date): LancamentoFormValues {
  const data = toDateOnly(hoje);
  return {
    categoria: '',
    descricao: '',
    valor: '',
    dataLancamento: data,
    mesCompetencia: data.slice(0, 7),
    visivelCliente: false,
  };
}

/** Editar: valores atuais do lançamento (valor com vírgula; competência `yyyy-MM`). */
export function lancamentoFormFrom(lancamento: LancamentoAdmin): LancamentoFormValues {
  return {
    categoria: categoriaParaRequest(lancamento.categoria),
    descricao: lancamento.descricao,
    valor: String(lancamento.valor).replace('.', ','),
    dataLancamento: lancamento.dataLancamento,
    mesCompetencia: lancamento.mesCompetencia.slice(0, 7),
    visivelCliente: lancamento.visivelCliente,
  };
}

/** Chave do servidor (minúscula) -> campo do formulário. `obraId` e o resto caem nos erros gerais. */
export const LANCAMENTO_CAMPOS_SERVIDOR: Record<string, LancamentoCampo> = {
  categoria: 'categoria',
  descricao: 'descricao',
  valor: 'valor',
  datalancamento: 'dataLancamento',
  mescompetencia: 'mesCompetencia',
  visivelcliente: 'visivelCliente',
};

/** Corpo do PUT (o POST acrescenta `obraId`). Só chamar com valores já validados pelo schema. */
export function toLancamentoBody(v: LancamentoFormValues): UpdateLancamentoRequest {
  return {
    categoria: v.categoria as UpdateLancamentoRequest['categoria'],
    descricao: v.descricao.trim(),
    valor: Number(parseDecimal(v.valor)),
    dataLancamento: v.dataLancamento.trim(),
    // O backend guarda a competência como o dia 1 do mês.
    mesCompetencia: `${v.mesCompetencia.trim()}-01`,
    visivelCliente: v.visivelCliente,
  };
}
