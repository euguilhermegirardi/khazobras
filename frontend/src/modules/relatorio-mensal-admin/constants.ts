import type { RelatorioMensalStatus } from '@/interfaces/relatorioMensal';

/** `relatorios_mensais.conteudo`: 1..20000 caracteres (RelatorioMensalRegras.MaxConteudo). */
export const CONTEUDO_MAX_LENGTH = 20000;

/** O histórico devolve até 100 registros (RelatorioMensalRegras.MaxItensHistorico). */
export const HISTORICO_MAX_ITENS = 100;

export const STATUS_LABEL: Record<RelatorioMensalStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
};

/** Mapa de status -> cor de `.claude/rules/frontend-design.md`: Rascunho = neutral, Publicado = success. */
export const STATUS_BADGE: Record<RelatorioMensalStatus, 'neutral' | 'success'> = {
  draft: 'neutral',
  published: 'success',
};

export const ACAO_LABEL: Record<string, string> = {
  relatorio_mensal_criado: 'Relatório criado',
  relatorio_mensal_editado: 'Relatório editado',
  relatorio_mensal_publicado: 'Relatório publicado',
};

/** Ação desconhecida (backend novo) cai neste texto, sem expor o código técnico. */
export const ACAO_DESCONHECIDA = 'Alteração no relatório';

/** Nomes dos campos da auditoria (`campos`) em português. */
export const CAMPO_LABEL: Record<string, string> = {
  competencia: 'Competência',
  conteudo: 'Conteúdo',
};

export const USUARIO_REMOVIDO = 'Usuário removido';

export const FILTRO_STATUS_OPCOES: { value: 'todos' | RelatorioMensalStatus; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'draft', label: STATUS_LABEL.draft },
  { value: 'published', label: STATUS_LABEL.published },
];
