import type { Etapa } from '@/interfaces/etapa';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { agruparProjetos, type GrupoProjetos } from '@/utils/agruparProjetos';
import { TITULO_ETAPA_DESCONHECIDA, TITULO_SEM_ETAPA } from './constants';

export type { GrupoProjetos };

/**
 * Um grupo por etapa, na ordem em que o backend entrega (etapa.ordem). Etapa que não pôde ser nomeada
 * (etapas não carregaram) junta-se em "Outros documentos"; sem etapa vai em "Documentos gerais", por último.
 */
export const agruparPorEtapa = (projetos: ProjetoDocumento[], etapas: Etapa[]): GrupoProjetos[] =>
  agruparProjetos(projetos, etapas, { semEtapa: TITULO_SEM_ETAPA, desconhecida: TITULO_ETAPA_DESCONHECIDA });
