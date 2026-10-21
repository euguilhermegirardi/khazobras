import { useEffect, useReducer, useRef, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { prepararAnexo } from '@/utils/anexo';
import { toMensagemErro } from '@/utils/erros';
import {
  filaReducer,
  proximoPendente,
  type UploadAcao,
  type UploadItem,
  type UploadRecusado,
} from '@/utils/uploadFila';

interface UseUploadFilaParams<Metadados> {
  /** Valida e põe na fila (cada módulo sabe o seu limite e as suas regras de arquivo). */
  prepararItens: (
    fila: UploadItem[],
    arquivos: File[],
    novoId: () => string,
  ) => { itens: UploadItem[]; recusados: UploadRecusado[] };
  /** Um POST. Rejeita com `ApiError` (400 `{ message }`, 403, 404...). */
  enviar: (file: File, metadados: Metadados, signal: AbortSignal) => Promise<unknown>;
  /** Fim de cada rodada (e ao sair da tela): normalmente relê a lista do servidor. */
  aoTerminar: () => void;
  /** Mensagem de erro que não vem da API (rede caída, bug). */
  mensagemFalha: string;
}

/** Erros que se repetiriam em todos os arquivos seguintes: a fila para e o resto fica pendente (dá para retomar). */
const PARA_A_FILA = new Set(['forbidden', 'not_found', 'unauthorized', 'network']);

/**
 * Fila de envio de arquivos: um POST por arquivo, **em sequência** (nunca em paralelo, para a ordem de chegada ser a
 * ordem escolhida e o limite do servidor não disputar corrida), com status por arquivo, repetir falhas e cancelar.
 * Cancelar não aborta o envio em andamento (ele poderia terminar no servidor mesmo assim): ele termina e os pendentes
 * viram "cancelada". Ao fim da rodada (e ao desmontar a tela) `aoTerminar` é chamado.
 */
export const useUploadFila = <Metadados>({
  prepararItens,
  enviar,
  aoTerminar,
  mensagemFalha,
}: UseUploadFilaParams<Metadados>) => {
  // Estados
  const [fila, dispatch] = useReducer(filaReducer, [] as UploadItem[]);
  const [rodando, setRodando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [recusados, setRecusados] = useState<UploadRecusado[]>([]);
  const [interrompida, setInterrompida] = useState<string | null>(null);
  // Espelho síncrono da fila: o laço de envio lê o estado mais novo sem esperar a renderização.
  const filaRef = useRef<UploadItem[]>([]);
  const rodandoRef = useRef(false);
  const cancelarRef = useRef(false);
  const contadorRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Functions
  const aplicar = (acao: UploadAcao) => {
    filaRef.current = filaReducer(filaRef.current, acao);
    dispatch(acao);
  };

  const novoId = () => {
    contadorRef.current += 1;
    return `upload-${contadorRef.current}`;
  };

  /** Valida e põe na fila. Devolve quantos entraram; os recusados ficam em `recusados` (com o motivo). */
  const adicionar = (arquivos: File[]) => {
    const { itens, recusados: novos } = prepararItens(filaRef.current, arquivos, novoId);
    setRecusados(novos);
    if (itens.length > 0) aplicar({ tipo: 'adicionar', itens });
    return itens.length;
  };

  const iniciar = async (metadados: Metadados) => {
    if (rodandoRef.current) return;
    rodandoRef.current = true;
    cancelarRef.current = false;
    setRodando(true);
    setCancelando(false);
    setInterrompida(null);
    const controle = new AbortController();
    abortRef.current = controle;
    try {
      for (;;) {
        const item = cancelarRef.current ? undefined : proximoPendente(filaRef.current);
        if (!item || controle.signal.aborted) break;
        aplicar({ tipo: 'status', id: item.id, status: 'enviando' });
        try {
          await enviar(prepararAnexo(item.file), metadados, controle.signal);
          aplicar({ tipo: 'status', id: item.id, status: 'enviada' });
        } catch (error) {
          if (controle.signal.aborted) {
            aplicar({ tipo: 'status', id: item.id, status: 'pendente' });
            break;
          }
          const { message, requestId } = toMensagemErro(error, mensagemFalha);
          const texto = requestId ? `${message} (código: ${requestId})` : message;
          aplicar({ tipo: 'status', id: item.id, status: 'erro', erro: texto });
          if (error instanceof ApiError && PARA_A_FILA.has(error.kind)) {
            setInterrompida(`Envio interrompido: ${message}`);
            break;
          }
        }
      }
    } finally {
      rodandoRef.current = false;
      abortRef.current = null;
      setRodando(false);
      setCancelando(false);
      aoTerminar();
    }
  };

  const cancelar = () => {
    cancelarRef.current = true;
    setCancelando(rodandoRef.current);
    aplicar({ tipo: 'cancelar' });
  };

  const repetirFalhas = (metadados: Metadados) => {
    aplicar({ tipo: 'repetir' });
    void iniciar(metadados);
  };

  const remover = (id: string) => aplicar({ tipo: 'remover', id });

  const limpar = () => {
    setRecusados([]);
    setInterrompida(null);
    aplicar({ tipo: 'limpar' });
  };

  // Effects (sair da tela interrompe o envio em andamento)
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return {
    fila,
    rodando,
    cancelando,
    recusados,
    interrompida,
    adicionar,
    iniciar,
    cancelar,
    repetirFalhas,
    remover,
    limpar,
  };
};
