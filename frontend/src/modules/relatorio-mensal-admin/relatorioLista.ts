import type {
  RelatorioMensalAdmin,
  RelatorioMensalHistorico,
  RelatorioMensalStatus,
} from '@/interfaces/relatorioMensal';
import { ApiError } from '@/services/apiClient';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { ACAO_DESCONHECIDA, ACAO_LABEL, CAMPO_LABEL, USUARIO_REMOVIDO } from './constants';

export type FiltroStatus = 'todos' | RelatorioMensalStatus;

/** Competência mais nova primeiro ("yyyy-MM-dd" ordena como texto); não altera o array recebido. */
export function ordenarPorCompetencia(relatorios: RelatorioMensalAdmin[]): RelatorioMensalAdmin[] {
  return [...relatorios].sort((a, b) => b.competencia.localeCompare(a.competencia));
}

export function filtrarPorStatus(relatorios: RelatorioMensalAdmin[], filtro: FiltroStatus): RelatorioMensalAdmin[] {
  return filtro === 'todos' ? relatorios : relatorios.filter((r) => r.status === filtro);
}

/** Ação da auditoria em português; código desconhecido vira texto genérico. */
export function acaoLegivel(acao: string): string {
  return ACAO_LABEL[acao] ?? ACAO_DESCONHECIDA;
}

/** "Competência e conteúdo"; campo desconhecido é ignorado; vazio = sem texto. */
export function camposLegiveis(campos: string[]): string {
  const nomes = campos.map((c) => CAMPO_LABEL[c]).filter((n): n is string => n !== undefined);
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function autorLegivel(item: Pick<RelatorioMensalHistorico, 'userName'>): string {
  const nome = item.userName?.trim();
  return nome ? nome : USUARIO_REMOVIDO;
}

/** Erro de uma ação (publicar, excluir): 409 vira o texto da tela (o do servidor vem sem acentos); o resto segue `toMensagemErro`. */
export function mensagemDeAcao(
  error: unknown,
  fallback: string,
  naoEncontrado: string,
  conflito: string,
): MensagemErro {
  if (error instanceof ApiError && error.kind === 'conflict') return { message: conflito };
  return toMensagemErro(error, fallback, naoEncontrado);
}
