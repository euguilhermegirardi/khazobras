/**
 * Espelha ProjetoDocumentoResponse. Não traz a chave de storage nem tamanho:
 * o arquivo vem de `GET /projetos/{id}/download`.
 */
export interface ProjetoDocumento {
  id: string;
  obraId: string;
  /** Null = documento geral da obra (sem etapa). */
  etapaId: string | null;
  /** Nome do arquivo, com extensão. */
  nome: string;
  /** Texto livre ("Planta baixa", "Memorial"...). */
  tipoDocumento: string | null;
  /** Timestamp ISO. */
  uploadedAt: string;
}

/** Corpo de `PUT /projetos/{id}` (admin): sempre os três campos; `null` limpa tipo e etapa. */
export interface ProjetoRequest {
  /** 1 a 255, sem barras nem caracteres de controle, com a extensão do arquivo. */
  nome: string;
  /** Até 50 caracteres. */
  tipoDocumento: string | null;
  etapaId: string | null;
}
