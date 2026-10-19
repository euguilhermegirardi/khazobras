/** Só os campos que as telas do cliente usam de EtapaResponse. */
export interface Etapa {
  id: string;
  obraId: string;
  nome: string;
  ordem: number;
}

/** EtapaResponse completa (Cronograma). Datas "yyyy-MM-dd" ou null; `status` em snake_case (`nao_iniciada`...). */
export interface EtapaCronograma extends Etapa {
  percentualPeso: number;
  dataInicioPrevista: string | null;
  dataInicioReal: string | null;
  dataFimPrevista: string | null;
  dataFimReal: string | null;
  status: string;
  /** Avanço físico da etapa, 0 a 100 (coerente com o status: 0 = não iniciada, 100 = concluída). */
  percentualConcluido: number;
  createdAt: string;
}

/** Corpo de `POST /etapas` (admin): a etapa nasce com 0% e `nao_iniciada`. Datas "yyyy-MM-dd" ou null. */
export type EtapaCreateRequest = {
  obraId: string;
  nome: string;
  ordem: number;
  percentualPeso: number;
  dataInicioPrevista: string | null;
  dataFimPrevista: string | null;
};

/** Corpo de `PUT /etapas/{id}` (admin). `status` em snake_case. */
export type EtapaUpdateRequest = {
  nome: string;
  ordem: number;
  percentualPeso: number;
  dataInicioPrevista: string | null;
  dataFimPrevista: string | null;
  dataInicioReal: string | null;
  dataFimReal: string | null;
  status: string;
  percentualConcluido: number;
};
