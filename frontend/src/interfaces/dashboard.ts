import type { ObraStatus } from './obra';

/**
 * Espelha `DashboardClienteResponse` do backend (Dashboard do cliente, SPEC §5). Só valores contratados e medições
 * aprovadas: o tipo não tem custo real, margem, peso das etapas nem lançamentos do financeiro (regra 7 do CLAUDE.md).
 * Datas "yyyy-MM-dd"; decimais chegam como número JSON.
 */
export interface DashboardResponse {
  obra: DashboardObra;
  /** 0 a 100, uma casa decimal (calculado no servidor). */
  avancoFisicoPercentual: number;
  prazo: DashboardPrazo;
  valores: DashboardValores;
  /** Ordenado por `ordem` pelo backend. */
  avancoPorEtapa: DashboardEtapa[];
  /** Só meses com medição aprovada, em ordem crescente. */
  medidoPorMes: DashboardMedidoMes[];
}

export interface DashboardObra {
  id: string;
  nome: string;
  dataInicio: string | null;
  dataPrevisaoTermino: string | null;
  status: ObraStatus;
}

/** `diasRestantes` negativo = atrasado; null quando a obra não tem data de previsão de término. */
export interface DashboardPrazo {
  diasRestantes: number | null;
  dataPrevisaoTermino: string | null;
}

export interface DashboardValores {
  valorContratado: number;
  /** Soma das medições aprovadas: é o "Custo acumulado" da visão cliente (não é custo real da empresa). */
  valorMedidoAcumulado: number;
  /** `valorContratado − valorMedidoAcumulado`; pode ser negativo. */
  valorRestante: number;
  totalPago: number;
}

export type DashboardEtapaStatus = 'nao_iniciada' | 'em_andamento' | 'concluida';

export interface DashboardEtapa {
  etapaId: string;
  nome: string;
  ordem: number;
  /** 0 a 100. */
  percentualConcluido: number;
  status: DashboardEtapaStatus;
  dataInicioPrevista: string | null;
  dataFimPrevista: string | null;
}

/** `competencia` = primeiro dia do mês; `valorMedidoAcumulado` é corrido até aquele mês. */
export interface DashboardMedidoMes {
  competencia: string;
  valorMedido: number;
  valorMedidoAcumulado: number;
}

/** Ponto do gráfico "Custo acumulado": um por mês, inclusive meses sem medição (valorMedido 0, acumulado mantido). */
export interface DashboardSerieMes extends DashboardMedidoMes {
  /** "Mar/26". */
  rotulo: string;
}
