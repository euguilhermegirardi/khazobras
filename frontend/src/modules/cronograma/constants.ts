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

/** Largura de um mês na linha do tempo (px). */
export const MONTH_WIDTH = 80

export const MENSAGEM_VAZIO = 'O cronograma desta obra ainda não foi cadastrado'
