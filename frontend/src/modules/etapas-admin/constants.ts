import { STATUS_CONCLUIDA, STATUS_EM_ANDAMENTO, STATUS_NAO_INICIADA } from '@/utils/etapaStatus';

/** Opções do select de status (valor em snake_case, como o backend espera). */
export const STATUS_OPCOES = [
  { value: STATUS_NAO_INICIADA, label: 'Não iniciada' },
  { value: STATUS_EM_ANDAMENTO, label: 'Em andamento' },
  { value: STATUS_CONCLUIDA, label: 'Concluída' },
] as const;

/** Regra de coerência entre status, % e datas reais (o backend é a fonte; isto só orienta o preenchimento). */
export const STATUS_REGRA: Record<string, string> = {
  [STATUS_NAO_INICIADA]: 'Não iniciada: 0% e sem datas reais.',
  [STATUS_EM_ANDAMENTO]: 'Em andamento: menos de 100%, com início real e sem fim real.',
  [STATUS_CONCLUIDA]: 'Concluída: 100%, com início e fim reais.',
};

export const MENSAGEM_VAZIO = 'Nenhuma etapa cadastrada';
