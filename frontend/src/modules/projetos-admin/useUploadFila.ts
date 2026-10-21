import { useQueryClient } from '@tanstack/react-query';
import { useUploadFila as useUploadFilaBase } from '@/hooks/useUploadFila';
import { uploadProjeto, type UploadProjetoMetadados } from './api';
import { invalidateProjetos } from './hooks';
import { prepararItens } from './uploadFila';

interface UseUploadFilaParams {
  obraId: string;
  /** Documentos que a obra já tem no servidor (conta para o limite de 200). */
  jaNaObra: number;
}

/**
 * Fila de envio de documentos de uma obra: a mecânica (sequência, status, cancelar, repetir) é a da base
 * (`hooks/useUploadFila`); aqui entram o limite de 200 documentos, o endpoint e a releitura da lista.
 */
export const useUploadFila = ({ obraId, jaNaObra }: UseUploadFilaParams) => {
  // Hooks
  const queryClient = useQueryClient();

  // Return
  return useUploadFilaBase<UploadProjetoMetadados>({
    prepararItens: (fila, arquivos, novoId) => prepararItens(fila, arquivos, jaNaObra, novoId),
    enviar: (file, metadados, signal) => uploadProjeto(obraId, file, metadados, signal),
    aoTerminar: () => void invalidateProjetos(queryClient, obraId),
    mensagemFalha: 'Não foi possível enviar o documento. Tente novamente.',
  });
};
