import { useEffect, useRef, useState } from 'react';

/** Quanto o envio fica travado depois de um sucesso (cobre a troca de tela e some se a tela não sair). */
const TRAVA_APOS_SUCESSO_MS = 3000;

/**
 * Trava de envio duplo de formulário.
 * - `isPending` da mutation só vira true depois de um render (e a validação do RHF é assíncrona), então um segundo
 *   submit pode entrar antes: o `ref` trava de forma síncrona.
 * - Depois do sucesso o formulário continua montado até a navegação terminar (o React Router troca a tela dentro de
 *   uma transição) e o botão voltava a ficar habilitado: um segundo clique criava o registro de novo. Quem chama
 *   `concluir()` antes de `onSaved` mantém a trava por alguns segundos; em erro a trava solta na hora.
 */
export const useEnvioUnico = () => {
  // Estados
  const [enviando, setEnviando] = useState(false);
  // Hooks
  const emCurso = useRef(false);
  const concluido = useRef(false);
  const liberar = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Functions
  const soltar = () => {
    emCurso.current = false;
    concluido.current = false;
    setEnviando(false);
  };

  const executar = async (acao: () => Promise<void>) => {
    if (emCurso.current) return;
    emCurso.current = true;
    concluido.current = false;
    setEnviando(true);
    try {
      await acao();
    } finally {
      if (concluido.current) liberar.current = setTimeout(soltar, TRAVA_APOS_SUCESSO_MS);
      else soltar();
    }
  };

  /** Marca o envio como bem-sucedido (chamar logo antes de fechar/navegar). */
  const concluir = () => {
    concluido.current = true;
  };

  // Effects (não solta estado depois de a tela sair)
  useEffect(
    () => () => {
      if (liberar.current) clearTimeout(liberar.current);
    },
    [],
  );

  return { enviando, executar, concluir };
};
