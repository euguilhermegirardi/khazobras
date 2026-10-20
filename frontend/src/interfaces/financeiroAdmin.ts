import type { LancamentoCliente } from './financeiro';

/**
 * Espelha FinanceiroLancamentoResponse (visão ADMIN). Acrescenta ao tipo do cliente `visivelCliente` e `createdAt`.
 * `createdByUserId` vem no JSON mas não é tipado nem exibido (id interno de usuário).
 */
export interface LancamentoAdmin extends LancamentoCliente {
  /** true = o cliente enxerga este lançamento. */
  visivelCliente: boolean;
  /** Instante ISO 8601. */
  createdAt: string;
}

/** Categoria no corpo dos requests (snake_case; a resposta volta em PascalCase: `LancamentoCategoria`). */
export type CategoriaRequest = 'mao_de_obra' | 'material' | 'equipamento';

/** Espelha FinanceiroCategoriaResponse (`GET /financeiro/categorias`). */
export interface CategoriaOpcao {
  valor: CategoriaRequest;
  rotulo: string;
}

/** Espelha FinanceiroResumoResponse. Tem custo real: só existe na visão admin. */
export interface FinanceiroResumo {
  totalLancado: number;
  totalLiberadoCliente: number;
  totalNaoLiberado: number;
  quantidadeLancamentos: number;
  quantidadeLiberada: number;
  quantidadeNaoLiberada: number;
}

/** Espelha CreateFinanceiroLancamentoRequest. Datas "yyyy-MM-dd"; `mesCompetencia` sempre o dia 1. */
export interface CreateLancamentoRequest {
  obraId: string;
  categoria: CategoriaRequest;
  descricao: string;
  valor: number;
  dataLancamento: string;
  mesCompetencia: string;
  visivelCliente: boolean;
}

/** Espelha UpdateFinanceiroLancamentoRequest (o mesmo do POST, sem `obraId`). */
export type UpdateLancamentoRequest = Omit<CreateLancamentoRequest, 'obraId'>;

/** Espelha FinanceiroVisibilidadeLoteResponse. */
export interface VisibilidadeLoteResponse {
  atualizados: number;
  visivelCliente: boolean;
}

/** Filtros da lista admin. Vazio = sem filtro. */
export interface LancamentosFiltros {
  /** '' = todos; 'true' = liberados; 'false' = ocultos. */
  visivelCliente: '' | 'true' | 'false';
  categoria: '' | CategoriaRequest;
  /** `yyyy-MM` (mês de competência) ou ''. */
  competencia: string;
}
