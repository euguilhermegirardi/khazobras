/** Espelha o status do backend (minúsculas, como o banco). */
export type RelatorioMensalStatus = 'draft' | 'published';

/**
 * Espelha RelatorioMensalClienteResponse (visão do cliente, sem `createdByUserId`). `competencia` é DATE ("yyyy-MM-dd"); `publishedAt`/`createdAt` são ISO 8601.
 * `conteudo` é texto puro: nunca renderizar como HTML.
 */
export interface RelatorioMensal {
  id: string;
  obraId: string;
  competencia: string;
  conteudo: string;
  status: RelatorioMensalStatus;
  publishedAt: string | null;
  createdAt: string;
}

/**
 * Visão Admin/Master (RelatorioMensalResponse): a do cliente + `updatedAt`. O `createdByUserId` que o backend manda
 * fica de fora do tipo de propósito: a tela nunca o mostra (o autor aparece no histórico, pelo nome).
 */
export interface RelatorioMensalAdmin extends RelatorioMensal {
  updatedAt: string;
}

/** Corpo do PUT: substitui os dois campos (só rascunho). `competencia` "yyyy-MM-dd"; o servidor grava o dia 1. */
export interface RelatorioMensalRequest {
  competencia: string;
  conteudo: string;
}

export interface CreateRelatorioMensalRequest extends RelatorioMensalRequest {
  obraId: string;
}

export type RelatorioMensalAcao = 'relatorio_mensal_criado' | 'relatorio_mensal_editado' | 'relatorio_mensal_publicado';

/** Um registro do histórico (auditoria): nunca traz o texto, só os nomes dos campos alterados (`campos`, na edição). */
export interface RelatorioMensalHistorico {
  /** Uma das três ações; o front trata ação desconhecida como texto genérico. */
  acao: string;
  userId: string | null;
  /** `null` = usuário não encontrado (removido). */
  userName: string | null;
  createdAt: string;
  campos: string[];
}
