import { useQuery } from '@tanstack/react-query'
import { listEtapas, listRelatoriosFotograficos } from './api'

export const useRelatoriosFotograficos = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'relatorios-fotograficos'] as const,
    queryFn: ({ signal }) => listRelatoriosFotograficos(obraId, signal),
  })

/** Falhar aqui não derruba a tela: sem o nome da etapa, usa-se o título do relatório. */
export const useEtapas = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'etapas'] as const,
    queryFn: ({ signal }) => listEtapas(obraId, signal),
  })
