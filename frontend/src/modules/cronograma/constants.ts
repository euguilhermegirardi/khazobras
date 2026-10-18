export type EtapaTone = 'success' | 'info' | 'neutral'

export const STATUS_NAO_INICIADA = 'nao_iniciada'
export const STATUS_EM_ANDAMENTO = 'em_andamento'
export const STATUS_CONCLUIDA = 'concluida'

/** Rótulo e cor por status (mapa de status do guia de design). Status fora da lista: neutro com o texto cru. */
export const ETAPA_STATUS: Record<string, { label: string; tone: EtapaTone }> = {
  [STATUS_NAO_INICIADA]: { label: 'Não iniciada', tone: 'neutral' },
  [STATUS_EM_ANDAMENTO]: { label: 'Em andamento', tone: 'info' },
  [STATUS_CONCLUIDA]: { label: 'Concluída', tone: 'success' },
}

/** Barra cheia da linha do tempo, por token do tema. */
export const BAR_CLASS: Record<EtapaTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  neutral: 'bg-neutral',
}

/** Barra do período realizado: cor que não é de nenhum status (a legenda usa a mesma classe). */
export const REAL_BAR_CLASS = 'bg-foreground'

/** Marcador de "Hoje": a mesma classe na linha e na legenda (2px para não borrar em posição fracionária). */
export const HOJE_CLASS = 'w-0.5 bg-danger'

/** Largura mínima de um mês (px): abaixo disso a linha do tempo rola dentro do card. Acima, o mês estica. */
export const MONTH_MIN_WIDTH = 48

/** Largura das colunas fixas Etapa + Situação (px): entra no cálculo da largura mínima da linha do tempo. */
export const LEFT_COLUMNS_WIDTH = 336

export const MENSAGEM_VAZIO = 'O cronograma desta obra ainda não foi cadastrado'
