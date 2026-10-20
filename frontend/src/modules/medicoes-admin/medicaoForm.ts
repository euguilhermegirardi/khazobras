import { z } from 'zod';
import type { CreateMedicaoRequest, MedicaoItemTipoRequest } from '@/interfaces/medicao';
import { parseDecimal } from '@/utils/decimal';
import { MAX_ITENS } from './constants';

/**
 * Formulário de nova medição. Todos os campos são texto (é o que os inputs entregam); a conversão para
 * número fica em `toCreateBody`. As regras espelham `CreateMedicaoRequestValidator` do backend, só para dar erro
 * imediato: quem decide é o servidor (que também recalcula todos os totais).
 */
export interface MedicaoItemFormValues {
  tipo: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
}

export interface MedicaoFormValues {
  numero: string;
  /** Mês no formato do `<input type="month">`: "2026-10". */
  competencia: string;
  /** Id da etapa; vazio = sem etapa. */
  etapaId: string;
  itens: MedicaoItemFormValues[];
}

export type MedicaoCampo = 'numero' | 'competencia' | 'etapaId';
export type MedicaoItemCampo = 'tipo' | 'descricao' | 'quantidade' | 'valorUnitario';

const NUMERO_MAX = 100_000;
const QUANTIDADE_MAX = 9_999_999_999.99;
const VALOR_MAX = 999_999_999_999.99;
const DESCRICAO_MAX = 255;
const TIPOS_VALIDOS: string[] = ['mao_de_obra', 'material', 'equipamento'] satisfies MedicaoItemTipoRequest[];
const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

// `parseDecimal` subiu para a base (`utils/decimal`, usado também por Contratos admin); o re-export mantém o import antigo.
export { parseDecimal };

const toCents = (texto: string): number | null => {
  const valor = parseDecimal(texto);
  return valor === null ? null : Math.round(valor * 100);
};

/** Total do item em centavos (quantidade x valor, arredondado a 2 casas); 0 se algum campo não for válido. */
function totalDoItemEmCentavos(item: Pick<MedicaoItemFormValues, 'quantidade' | 'valorUnitario'>): number {
  const quantidade = toCents(item.quantidade);
  const unitario = toCents(item.valorUnitario);
  if (quantidade === null || unitario === null) return 0;
  return Math.round((quantidade * unitario) / 100);
}

/** Só para exibir (o servidor recalcula). Em reais, com 2 casas. */
export function totalDoItem(item: Pick<MedicaoItemFormValues, 'quantidade' | 'valorUnitario'>): number {
  return totalDoItemEmCentavos(item) / 100;
}

/** Soma dos itens, só para exibir: soma em centavos inteiros para não acumular erro de ponto flutuante. */
export function totalGeral(itens: Pick<MedicaoItemFormValues, 'quantidade' | 'valorUnitario'>[]): number {
  return itens.reduce((soma, item) => soma + totalDoItemEmCentavos(item), 0) / 100;
}

export function itemVazio(): MedicaoItemFormValues {
  return { tipo: 'material', descricao: '', quantidade: '1', valorUnitario: '' };
}

/** "2026-10" do mês de uma data local (padrão da competência). */
export function mesAtual(hoje: Date): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Próximo número sugerido: o maior número visto + 1. `maiorNumeroDaPagina` vem da página carregada (a lista é
 * ordenada pela criação, não pelo número) e `totalDeMedicoes` serve de piso (os números costumam ser 1..N).
 * É só uma sugestão: o servidor recusa número repetido (409).
 */
export function proximoNumero(maiorNumeroDaPagina: number, totalDeMedicoes: number): number {
  return Math.max(maiorNumeroDaPagina, totalDeMedicoes, 0) + 1;
}

export const medicaoFormSchema = z
  .object({
    numero: z.string(),
    competencia: z.string(),
    etapaId: z.string(),
    itens: z.array(
      z.object({
        tipo: z.string(),
        descricao: z.string(),
        quantidade: z.string(),
        valorUnitario: z.string(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const erro = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });

    const numero = v.numero.trim();
    if (!/^\d+$/.test(numero) || Number(numero) < 1 || Number(numero) > NUMERO_MAX) {
      erro(['numero'], `Informe o número da medição (inteiro de 1 a ${NUMERO_MAX.toLocaleString('pt-BR')}).`);
    }

    const mes = MES.exec(v.competencia.trim());
    if (!mes) erro(['competencia'], 'Informe a competência (mês e ano, ex.: 2026-10).');
    else if (Number(mes[1]) < 2000 || Number(mes[1]) > 2100)
      erro(['competencia'], 'O ano deve estar entre 2000 e 2100.');

    if (v.itens.length === 0) erro(['itens'], 'Adicione pelo menos um item.');
    else if (v.itens.length > MAX_ITENS) erro(['itens'], `A medição aceita no máximo ${MAX_ITENS} itens.`);

    v.itens.forEach((item, i) => {
      if (!TIPOS_VALIDOS.includes(item.tipo)) erro(['itens', i, 'tipo'], 'Escolha o tipo do item.');

      const descricao = item.descricao.trim();
      if (descricao === '') erro(['itens', i, 'descricao'], 'Informe a descrição.');
      else if (descricao.length > DESCRICAO_MAX) {
        erro(['itens', i, 'descricao'], `A descrição aceita no máximo ${DESCRICAO_MAX} caracteres.`);
      }

      const quantidade = parseDecimal(item.quantidade);
      if (quantidade === null) erro(['itens', i, 'quantidade'], 'Informe a quantidade (até 2 casas decimais).');
      else if (quantidade <= 0) erro(['itens', i, 'quantidade'], 'A quantidade deve ser maior que zero.');
      else if (quantidade > QUANTIDADE_MAX) erro(['itens', i, 'quantidade'], 'A quantidade excede o limite permitido.');

      const unitario = parseDecimal(item.valorUnitario);
      if (unitario === null) erro(['itens', i, 'valorUnitario'], 'Informe o valor unitário (até 2 casas decimais).');
      else if (unitario > VALOR_MAX) erro(['itens', i, 'valorUnitario'], 'O valor unitário excede o limite permitido.');
    });

    if (v.itens.length > 0 && v.itens.length <= MAX_ITENS && totalGeral(v.itens) > VALOR_MAX) {
      erro(['itens'], 'O valor total da medição excede o limite permitido.');
    }
  });

export function medicaoFormDefaults(proximo: number, competencia: string): MedicaoFormValues {
  return { numero: String(proximo), competencia, etapaId: '', itens: [itemVazio()] };
}

/** Corpo do `POST /medicoes`. Só chamar com valores já validados pelo schema. */
export function toCreateBody(obraId: string, v: MedicaoFormValues): CreateMedicaoRequest {
  return {
    obraId,
    etapaId: v.etapaId === '' ? null : v.etapaId,
    numero: Number(v.numero.trim()),
    competencia: `${v.competencia.trim()}-01`,
    itens: v.itens.map((item) => ({
      tipo: item.tipo as MedicaoItemTipoRequest,
      descricao: item.descricao.trim(),
      quantidade: Number(parseDecimal(item.quantidade)),
      valorUnitario: Number(parseDecimal(item.valorUnitario)),
    })),
  };
}

const CAMPO_ITEM = /^itens\.\d+\.(tipo|descricao|quantidade|valorUnitario)$/;
const CAMPO_RAIZ = /^(numero|competencia|etapaId|itens)$/;

/** "Itens[0].Tipo" -> "itens.0.tipo"; "Numero" -> "numero". */
const toFieldPath = (chave: string): string =>
  chave
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((parte) => (/^\d+$/.test(parte) ? parte : parte.charAt(0).toLowerCase() + parte.slice(1)))
    .join('.');

/**
 * Erros do servidor (`{ errors: { "Itens[0].Tipo": [msg] } }`) para os caminhos do formulário
 * (`itens.0.tipo`). O que não for campo do formulário (ex.: `ObraId`) vai em `gerais`.
 */
export function mapServerErrors(fieldErrors: Record<string, string[]> | undefined): {
  campos: Record<string, string>;
  gerais: string[];
} {
  const campos: Record<string, string> = {};
  const gerais: string[] = [];
  for (const [chave, mensagens] of Object.entries(fieldErrors ?? {})) {
    const caminho = toFieldPath(chave);
    if (CAMPO_RAIZ.test(caminho) || CAMPO_ITEM.test(caminho)) campos[caminho] = mensagens.join(' ');
    else gerais.push(...mensagens);
  }
  return { campos, gerais };
}
