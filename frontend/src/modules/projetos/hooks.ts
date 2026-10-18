import { useMutation, useQuery } from '@tanstack/react-query'
import type { ProjetoDocumento } from '@/interfaces/projeto'
import { openBlobInNewTab, saveBlob } from '@/utils/download'
import { downloadProjeto, listProjetos } from './api'

export type ProjetoAcao = 'visualizar' | 'baixar'

export interface ProjetoAcaoVariables {
  projeto: ProjetoDocumento
  acao: ProjetoAcao
}

export const useProjetos = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'projetos'] as const,
    queryFn: ({ signal }) => listProjetos(obraId, signal),
  })

/** Baixa o arquivo pela API e o salva ou abre em nova aba. `variables` diz qual item está em andamento. */
export const useAcaoProjeto = () =>
  useMutation({
    mutationFn: async ({ projeto, acao }: ProjetoAcaoVariables) => {
      const { blob, fileName } = await downloadProjeto(projeto)
      if (acao === 'visualizar') openBlobInNewTab(blob)
      else saveBlob(blob, fileName)
    },
  })
