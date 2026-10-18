import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import type { LancamentoAnexo } from '@/interfaces/financeiro'
import { saveBlob } from '@/utils/download'
import { downloadComprovante, listLancamentos } from './api'
import { PAGE_SIZE } from './constants'

export const useLancamentos = (obraId: string, pageIndex: number) =>
  useQuery({
    queryKey: ['obra', obraId, 'financeiro', 'lancamentos', pageIndex] as const,
    queryFn: ({ signal }) => listLancamentos(obraId, pageIndex, PAGE_SIZE, signal),
    // Ao trocar de página a tabela anterior continua na tela até a nova chegar.
    placeholderData: keepPreviousData,
  })

/** Baixa e salva o comprovante. Só um por vez; `variables` diz qual está em andamento. */
export const useDownloadComprovante = () =>
  useMutation({
    mutationFn: async (anexo: LancamentoAnexo) => {
      const { blob, fileName } = await downloadComprovante(anexo)
      saveBlob(blob, fileName)
    },
  })
