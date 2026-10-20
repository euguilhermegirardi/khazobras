export type RelatorioFotograficoTipo = 'mensal' | 'etapa';

/** Espelha FotoResponse. Não traz a chave de storage: a imagem vem de `GET /fotos/{id}/arquivo`. */
export interface Foto {
  id: string;
  /** DATE ("yyyy-MM-dd"). */
  dataFoto?: string | null;
  descricao?: string | null;
  ordem: number;
  createdAt: string;
}

/** Espelha RelatorioFotograficoResponse. `competencia` (DATE) vale para `mensal`; `etapaId` para `etapa`. */
export interface RelatorioFotografico {
  id: string;
  obraId: string;
  tipo: RelatorioFotograficoTipo;
  etapaId?: string | null;
  titulo: string;
  competencia?: string | null;
  createdAt: string;
  /** Computada no servidor (= `fotos.length`). */
  quantidadeFotos?: number;
  fotos: Foto[];
}

/** Corpo de `PUT /relatorios-fotograficos/{id}` (admin): os quatro campos; `null` limpa etapa/competência. */
export interface RelatorioFotograficoRequest {
  tipo: RelatorioFotograficoTipo;
  etapaId: string | null;
  /** 1 a 150 caracteres. */
  titulo: string;
  /** "yyyy-MM-dd" (dia 1 do mês) ou null; anos 2000 a 2100. */
  competencia: string | null;
}

/** Corpo de `POST /relatorios-fotograficos` (admin). */
export interface CreateRelatorioFotograficoRequest extends RelatorioFotograficoRequest {
  obraId: string;
}

/** Corpo de `PATCH /fotos/{id}` (admin): parcial. `descricao`/`dataFoto` aceitam null (limpam); `ordem` não. */
export interface UpdateFotoRequest {
  descricao?: string | null;
  dataFoto?: string | null;
  ordem?: number;
}

/** Item do lote de `PATCH /relatorios-fotograficos/{id}/fotos/ordem` (máx. 200; ids únicos; `ordem` 0 a 100000). */
export interface FotoOrdemItem {
  id: string;
  ordem: number;
}
