import { FOTO_MAX_POR_RELATORIO, validarFoto } from '@/utils/foto';
import { prepararItens as prepararItensGenerico, type UploadItem, type UploadRecusado } from '@/utils/uploadFila';

// A fila em si (estado, transições, resumo) é da base: `utils/uploadFila.ts`, dividida com Projetos.
export {
  filaReducer,
  proximoPendente,
  resumoFila,
  type ResumoFila,
  type UploadAcao,
  type UploadItem,
  type UploadRecusado,
  type UploadStatus,
} from '@/utils/uploadFila';

/**
 * Valida as fotos escolhidas e separa as que entram na fila das recusadas. O limite de 100 por relatório conta as
 * fotos que o servidor já tem (`jaNoRelatorio`) mais as que estão na fila esperando ou sendo enviadas; o que passar
 * do limite é recusado, na ordem de escolha (o servidor ainda confere: 400 na 101ª). `novoId` gera o id de cada item.
 */
export function prepararItens(
  fila: UploadItem[],
  arquivos: File[],
  jaNoRelatorio: number,
  novoId: () => string,
): { itens: UploadItem[]; recusados: UploadRecusado[] } {
  return prepararItensGenerico(fila, arquivos, {
    validar: validarFoto,
    limite: FOTO_MAX_POR_RELATORIO,
    jaNoServidor: jaNoRelatorio,
    mensagemLimite: `Limite de ${FOTO_MAX_POR_RELATORIO} fotos por relatório atingido.`,
    novoId,
  });
}
