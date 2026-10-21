import type { Etapa } from '@/interfaces/etapa';
import type { ProjetoDocumento } from '@/interfaces/projeto';

export interface GrupoProjetos {
  key: string;
  titulo: string;
  projetos: ProjetoDocumento[];
}

export interface TitulosGrupos {
  /** Documentos sem etapa. */
  semEtapa: string;
  /** Documentos de uma etapa que não pôde ser nomeada (as etapas não carregaram). */
  desconhecida: string;
}

/**
 * Um grupo por etapa, na ordem em que o backend entrega (etapa.ordem). Etapa que não pôde ser nomeada junta-se em um
 * grupo só (`titulos.desconhecida`); sem etapa vai por último (`titulos.semEtapa`). Cliente e admin usam títulos
 * diferentes para os dois grupos de exceção.
 */
export function agruparProjetos(
  projetos: ProjetoDocumento[],
  etapas: Etapa[],
  titulos: TitulosGrupos,
): GrupoProjetos[] {
  const nomes = new Map(etapas.map((etapa) => [etapa.id, etapa.nome]));
  const porEtapa = new Map<string, GrupoProjetos>();
  const desconhecidos: ProjetoDocumento[] = [];
  const gerais: ProjetoDocumento[] = [];

  for (const projeto of projetos) {
    if (projeto.etapaId === null) {
      gerais.push(projeto);
      continue;
    }
    const nome = nomes.get(projeto.etapaId);
    if (nome === undefined) {
      desconhecidos.push(projeto);
      continue;
    }
    const grupo = porEtapa.get(projeto.etapaId);
    if (grupo) grupo.projetos.push(projeto);
    else porEtapa.set(projeto.etapaId, { key: projeto.etapaId, titulo: nome, projetos: [projeto] });
  }

  const grupos = [...porEtapa.values()];
  if (desconhecidos.length > 0) {
    grupos.push({ key: 'outros', titulo: titulos.desconhecida, projetos: desconhecidos });
  }
  if (gerais.length > 0) grupos.push({ key: 'gerais', titulo: titulos.semEtapa, projetos: gerais });
  return grupos;
}
