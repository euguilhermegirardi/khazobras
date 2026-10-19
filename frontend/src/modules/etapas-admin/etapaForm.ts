import { z } from 'zod';
import type { EtapaCreateRequest, EtapaCronograma, EtapaUpdateRequest } from '@/interfaces/etapa';
import { STATUS_CONCLUIDA, STATUS_EM_ANDAMENTO, STATUS_NAO_INICIADA } from '@/utils/etapaStatus';

/**
 * Formulário da etapa. Todos os campos são texto (é o que os inputs entregam); a conversão para número/null
 * fica em `toCreateBody`/`toUpdateBody`. As regras espelham `UpdateEtapaRequestValidator` do backend,
 * só para dar erro imediato: quem decide é o servidor.
 */
const CAMPOS = [
  'nome',
  'ordem',
  'percentualPeso',
  'dataInicioPrevista',
  'dataFimPrevista',
  'dataInicioReal',
  'dataFimReal',
  'status',
  'percentualConcluido',
] as const;

export type EtapaCampo = (typeof CAMPOS)[number];

const STATUS_VALIDOS: string[] = [STATUS_NAO_INICIADA, STATUS_EM_ANDAMENTO, STATUS_CONCLUIDA];

function toNumber(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '') return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

export const etapaFormSchema = z
  .object({
    nome: z.string(),
    ordem: z.string(),
    percentualPeso: z.string(),
    dataInicioPrevista: z.string(),
    dataFimPrevista: z.string(),
    dataInicioReal: z.string(),
    dataFimReal: z.string(),
    status: z.string(),
    percentualConcluido: z.string(),
  })
  // Tudo num só superRefine: as regras entre campos (status x % x datas) rodam junto com as de cada campo.
  .superRefine((v, ctx) => {
    const erro = (path: EtapaCampo, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    const nome = v.nome.trim();
    if (nome === '') erro('nome', 'Informe o nome da etapa.');
    else if (nome.length > 150) erro('nome', 'O nome pode ter no máximo 150 caracteres.');

    const ordem = toNumber(v.ordem);
    if (ordem === null || !Number.isInteger(ordem) || ordem < 1)
      erro('ordem', 'Informe a ordem (número inteiro, 1 ou mais).');

    const peso = toNumber(v.percentualPeso);
    if (peso === null || peso < 0 || peso > 100) erro('percentualPeso', 'O peso deve estar entre 0 e 100.');

    const concluido = toNumber(v.percentualConcluido);
    if (concluido === null || concluido < 0 || concluido > 100) {
      erro('percentualConcluido', 'O % concluído deve estar entre 0 e 100.');
    }

    if (v.dataInicioPrevista && v.dataFimPrevista && v.dataFimPrevista < v.dataInicioPrevista) {
      erro('dataFimPrevista', 'O fim previsto não pode ser anterior ao início previsto.');
    }
    if (v.dataInicioReal && v.dataFimReal && v.dataFimReal < v.dataInicioReal) {
      erro('dataFimReal', 'O fim real não pode ser anterior ao início real.');
    }

    if (!STATUS_VALIDOS.includes(v.status)) {
      erro('status', 'Escolha um status.');
      return;
    }

    // Coerência status x avanço x datas reais (só quando o % é um número válido, para não empilhar erros).
    const percentualValido = concluido !== null && concluido >= 0 && concluido <= 100;
    if (v.status === STATUS_NAO_INICIADA) {
      if (percentualValido && concluido !== 0) erro('percentualConcluido', 'Etapa não iniciada deve ter 0%.');
      if (v.dataInicioReal) erro('dataInicioReal', 'Etapa não iniciada não pode ter início real.');
      if (v.dataFimReal) erro('dataFimReal', 'Etapa não iniciada não pode ter fim real.');
    } else if (v.status === STATUS_EM_ANDAMENTO) {
      if (percentualValido && concluido >= 100) erro('percentualConcluido', 'Com 100% a etapa deve estar concluída.');
      if (!v.dataInicioReal) erro('dataInicioReal', 'Etapa em andamento exige o início real.');
      if (v.dataFimReal) erro('dataFimReal', 'Etapa em andamento não pode ter fim real.');
    } else {
      if (percentualValido && concluido !== 100) erro('percentualConcluido', 'Etapa concluída deve ter 100%.');
      if (!v.dataInicioReal) erro('dataInicioReal', 'Etapa concluída exige o início real.');
      if (!v.dataFimReal) erro('dataFimReal', 'Etapa concluída exige o fim real.');
    }
  });

export type EtapaFormValues = z.infer<typeof etapaFormSchema>;

/** Valores iniciais: etapa existente (edição) ou formulário limpo com a próxima ordem (criação). */
export function etapaFormDefaults(etapa: EtapaCronograma | null, proximaOrdem: number): EtapaFormValues {
  if (!etapa) {
    return {
      nome: '',
      ordem: String(proximaOrdem),
      percentualPeso: '0',
      dataInicioPrevista: '',
      dataFimPrevista: '',
      dataInicioReal: '',
      dataFimReal: '',
      status: STATUS_NAO_INICIADA,
      percentualConcluido: '0',
    };
  }
  return {
    nome: etapa.nome,
    ordem: String(etapa.ordem),
    percentualPeso: String(etapa.percentualPeso),
    dataInicioPrevista: etapa.dataInicioPrevista ?? '',
    dataFimPrevista: etapa.dataFimPrevista ?? '',
    dataInicioReal: etapa.dataInicioReal ?? '',
    dataFimReal: etapa.dataFimReal ?? '',
    status: etapa.status,
    percentualConcluido: String(etapa.percentualConcluido),
  };
}

const dateOrNull = (texto: string): string | null => (texto === '' ? null : texto);

export function toCreateBody(obraId: string, v: EtapaFormValues): EtapaCreateRequest {
  return {
    obraId,
    nome: v.nome.trim(),
    ordem: Number(toNumber(v.ordem)),
    percentualPeso: Number(toNumber(v.percentualPeso)),
    dataInicioPrevista: dateOrNull(v.dataInicioPrevista),
    dataFimPrevista: dateOrNull(v.dataFimPrevista),
  };
}

export function toUpdateBody(v: EtapaFormValues): EtapaUpdateRequest {
  return {
    nome: v.nome.trim(),
    ordem: Number(toNumber(v.ordem)),
    percentualPeso: Number(toNumber(v.percentualPeso)),
    dataInicioPrevista: dateOrNull(v.dataInicioPrevista),
    dataFimPrevista: dateOrNull(v.dataFimPrevista),
    dataInicioReal: dateOrNull(v.dataInicioReal),
    dataFimReal: dateOrNull(v.dataFimReal),
    status: v.status,
    percentualConcluido: Number(toNumber(v.percentualConcluido)),
  };
}

/** Status sugerido para um % (0 → não iniciada, 100 → concluída, senão em andamento); null se o texto não é um % válido. */
export function sugerirStatus(percentual: string): string | null {
  const valor = toNumber(percentual);
  if (valor === null || valor < 0 || valor > 100) return null;
  if (valor === 0) return STATUS_NAO_INICIADA;
  if (valor === 100) return STATUS_CONCLUIDA;
  return STATUS_EM_ANDAMENTO;
}

/**
 * Erros do servidor (`{ errors: { Campo: [msg] } }`, chaves em PascalCase) para os campos do formulário.
 * O que não for campo do formulário (ex.: `ObraId`) vai em `gerais`.
 */
export function mapServerErrors(fieldErrors: Record<string, string[]> | undefined): {
  campos: Partial<Record<EtapaCampo, string>>;
  gerais: string[];
} {
  const campos: Partial<Record<EtapaCampo, string>> = {};
  const gerais: string[] = [];
  for (const [chave, mensagens] of Object.entries(fieldErrors ?? {})) {
    const nome = chave.charAt(0).toLowerCase() + chave.slice(1);
    const campo = CAMPOS.find((c) => c === nome);
    if (campo) campos[campo] = mensagens.join(' ');
    else gerais.push(...mensagens);
  }
  return { campos, gerais };
}
