import type { Etapa } from '@/interfaces/etapa'
import type { ProjetoDocumento } from '@/interfaces/projeto'
import { TITULO_ETAPA_DESCONHECIDA, TITULO_SEM_ETAPA } from './constants'

export interface GrupoProjetos {
  key: string
  titulo: string
  projetos: ProjetoDocumento[]
}

/**
 * Um grupo por etapa, na ordem em que o backend entrega (etapa.ordem). Etapa que não pôde ser nomeada
 * (etapas não carregaram) junta-se em "Outros documentos"; sem etapa vai em "Documentos gerais", por último.
 */
export const agruparPorEtapa = (projetos: ProjetoDocumento[], etapas: Etapa[]): GrupoProjetos[] => {
  const nomes = new Map(etapas.map((etapa) => [etapa.id, etapa.nome]))
  const porEtapa = new Map<string, GrupoProjetos>()
  const desconhecidos: ProjetoDocumento[] = []
  const gerais: ProjetoDocumento[] = []

  for (const projeto of projetos) {
    if (projeto.etapaId === null) {
      gerais.push(projeto)
      continue
    }
    const nome = nomes.get(projeto.etapaId)
    if (nome === undefined) {
      desconhecidos.push(projeto)
      continue
    }
    const grupo = porEtapa.get(projeto.etapaId)
    if (grupo) grupo.projetos.push(projeto)
    else porEtapa.set(projeto.etapaId, { key: projeto.etapaId, titulo: nome, projetos: [projeto] })
  }

  const grupos = [...porEtapa.values()]
  if (desconhecidos.length > 0) grupos.push({ key: 'outros', titulo: TITULO_ETAPA_DESCONHECIDA, projetos: desconhecidos })
  if (gerais.length > 0) grupos.push({ key: 'gerais', titulo: TITULO_SEM_ETAPA, projetos: gerais })
  return grupos
}
