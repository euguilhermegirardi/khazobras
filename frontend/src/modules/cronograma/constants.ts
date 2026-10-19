import type { EtapaTone } from '@/utils/etapaStatus';

// Rótulos e cores por status moram na base (utils/etapaStatus.ts): o Gantt do admin usa o mesmo mapa.
export {
  ETAPA_STATUS,
  STATUS_CONCLUIDA,
  STATUS_EM_ANDAMENTO,
  STATUS_NAO_INICIADA,
  type EtapaTone,
} from '@/utils/etapaStatus';

/** Barra cheia da linha do tempo, por token do tema. */
export const BAR_CLASS: Record<EtapaTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  neutral: 'bg-neutral',
};

/** Barra do período realizado: cor que não é de nenhum status (a legenda usa a mesma classe). */
export const REAL_BAR_CLASS = 'bg-foreground';

/** Marcador de "Hoje": a mesma classe na linha e na legenda (2px para não borrar em posição fracionária). */
export const HOJE_CLASS = 'w-0.5 bg-danger';

/** Largura mínima de um mês (px): abaixo disso a linha do tempo rola dentro do card. Acima, o mês estica. */
export const MONTH_MIN_WIDTH = 48;

/** Largura das colunas fixas Etapa + Situação (px): entra no cálculo da largura mínima da linha do tempo. */
export const LEFT_COLUMNS_WIDTH = 336;

export const MENSAGEM_VAZIO = 'O cronograma desta obra ainda não foi cadastrado';
