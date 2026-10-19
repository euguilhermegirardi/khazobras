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
