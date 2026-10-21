import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { prepararAnexo } from '@/utils/anexo';
import { toMensagemErro } from '@/utils/erros';
import { uploadFoto, type UploadFotoMetadados } from './api';
import { invalidateRelatorios } from './hooks';
import {
  filaReducer,
  prepararItens,
  proximoPendente,
  type UploadAcao,
  type UploadItem,
  type UploadRecusado,
} from './uploadFila';

interface UseUploadFilaParams {
  obraId: string;
  relatorioId: string;
  /** Fotos que o relatório já tem no servidor (conta para o limite de 100). */
  jaNoRelatorio: number;
}

/** Erros que se repetiriam em todas as fotos seguintes: a fila para e o resto fica pendente (dá para retomar). */
const PARA_A_FILA = new Set(['forbidden', 'not_found', 'unauthorized', 'network']);

/**
 * Fila de envio de fotos: um POST por arquivo, **em sequência** (nunca em paralelo, para a ordem de chegada ser a ordem
 * escolhida e o limite de 100 não disputar corrida), com status por arquivo, repetir falhas e cancelar.
 * Cancelar não aborta o envio em andamento (ele poderia terminar no servidor mesmo assim): ele termina e os pendentes
 * viram "cancelada". Ao fim da rodada (e ao desmontar a tela) a lista de relatórios é relida.
 */
export const useUploadFila = ({ obraId, relatorioId, jaNoRelatorio }: UseUploadFilaParams) => {
  // Estados
  const [fila, dispatch] = useReducer(filaReducer, [] as UploadItem[]);
  const [rodando, setRodando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [recusados, setRecusados] = useState<UploadRecusado[]>([]);
  const [interrompida, setInterrompida] = useState<string | null>(null);
  // Hooks
  const queryClient = useQueryClient();
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
    const { itens, recusados: novos } = prepararItens(filaRef.current, arquivos, jaNoRelatorio, novoId);
    setRecusados(novos);
    if (itens.length > 0) aplicar({ tipo: 'adicionar', itens });
    return itens.length;
  };

  const iniciar = async (metadados: UploadFotoMetadados) => {
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
          await uploadFoto(relatorioId, prepararAnexo(item.file), metadados, controle.signal);
          aplicar({ tipo: 'status', id: item.id, status: 'enviada' });
        } catch (error) {
          if (controle.signal.aborted) {
            aplicar({ tipo: 'status', id: item.id, status: 'pendente' });
            break;
          }
          const { message, requestId } = toMensagemErro(error, 'Não foi possível enviar a foto. Tente novamente.');
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
      void invalidateRelatorios(queryClient, obraId);
    }
  };

  const cancelar = () => {
    cancelarRef.current = true;
    setCancelando(rodandoRef.current);
    aplicar({ tipo: 'cancelar' });
  };

  const repetirFalhas = (metadados: UploadFotoMetadados) => {
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
