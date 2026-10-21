import { prepararItens as prepararItensGenerico, type UploadItem, type UploadRecusado } from '@/utils/uploadFila';
import { PROJETO_MAX_POR_OBRA, validarProjetoArquivo } from './projetoRegras';

/**
 * Valida os arquivos escolhidos e separa os que entram na fila dos recusados. O limite de 200 por obra conta os
 * documentos que o servidor já tem (`jaNaObra`) mais os que estão na fila esperando ou sendo enviados; o que passar do
 * limite é recusado, na ordem de escolha (o servidor ainda confere: 400 no 201º).
 */
export function prepararItens(
  fila: UploadItem[],
  arquivos: File[],
  jaNaObra: number,
  novoId: () => string,
): { itens: UploadItem[]; recusados: UploadRecusado[] } {
  return prepararItensGenerico(fila, arquivos, {
    validar: validarProjetoArquivo,
    limite: PROJETO_MAX_POR_OBRA,
    jaNoServidor: jaNaObra,
    mensagemLimite: `Limite de ${PROJETO_MAX_POR_OBRA} documentos por obra atingido.`,
    novoId,
  });
}
