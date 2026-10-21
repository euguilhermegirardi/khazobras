import { useQueryClient } from '@tanstack/react-query';
import { useUploadFila as useUploadFilaBase } from '@/hooks/useUploadFila';
import { uploadFoto, type UploadFotoMetadados } from './api';
import { invalidateRelatorios } from './hooks';
import { prepararItens } from './uploadFila';

interface UseUploadFilaParams {
  obraId: string;
  relatorioId: string;
  /** Fotos que o relatório já tem no servidor (conta para o limite de 100). */
  jaNoRelatorio: number;
}

/**
 * Fila de envio de fotos de um relatório: a mecânica (sequência, status, cancelar, repetir) é a da base
 * (`hooks/useUploadFila`); aqui entram o limite de 100 fotos, o endpoint e a releitura da lista de relatórios.
 */
export const useUploadFila = ({ obraId, relatorioId, jaNoRelatorio }: UseUploadFilaParams) => {
  // Hooks
  const queryClient = useQueryClient();

  // Return
  return useUploadFilaBase<UploadFotoMetadados>({
    prepararItens: (fila, arquivos, novoId) => prepararItens(fila, arquivos, jaNoRelatorio, novoId),
    enviar: (file, metadados, signal) => uploadFoto(relatorioId, file, metadados, signal),
    aoTerminar: () => void invalidateRelatorios(queryClient, obraId),
    mensagemFalha: 'Não foi possível enviar a foto. Tente novamente.',
  });
};
