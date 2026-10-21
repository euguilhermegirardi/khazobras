import { ApiError } from '@/services/apiClient';

export interface MensagemErro {
  message: string;
  /** Presente nos 500: o usuário informa ao suporte. */
  requestId?: string;
}

/**
 * Erro de uma ação (não de campo) em texto para o `Alert`: a mensagem da API (403, 409, 400 `{ message }`, 500 com
 * `requestId`); 404 com o texto da tela; qualquer outra coisa (rede, bug) cai na mensagem padrão da ação.
 */
export function toMensagemErro(error: unknown, fallback: string, naoEncontrado?: string): MensagemErro {
  if (error instanceof ApiError) {
    if (error.kind === 'not_found' && naoEncontrado) return { message: naoEncontrado };
    return { message: error.message, requestId: error.requestId };
  }
  return { message: fallback };
}
