import { useEffect, useRef, useState } from 'react';
import { ErroAlert } from '@/components/ErroAlert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { idBotaoMover } from '../fotoNome';
import { useReordenarFotos, useRemoverFoto } from '../hooks';
import { moverFoto, ordemAlterada } from '../reordenar';
import { FotoCard } from './FotoCard';
import { FotoEditDialog } from './FotoEditDialog';

interface FotosGridProps {
  obraId: string;
  relatorioId: string;
  /** Fotos na ordem de exibição (`ordenarFotos`). */
  fotos: Foto[];
}

const NAO_ENCONTRADA = 'Foto não encontrada. Atualize a página.';

export const FotosGrid = ({ obraId, relatorioId, fotos }: FotosGridProps) => {
  // Estados
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erro, setErro] = useState<MensagemErro | null>(null);
  /** Frase para leitor de tela depois de mover ("Foto movida para a posição 2 de 7."). */
  const [aviso, setAviso] = useState('');
  // Hooks
  const reordenar = useReordenarFotos(obraId, relatorioId);
  const remover = useRemoverFoto(obraId);
  /** Botão que tinha o foco quando a foto foi movida: a grade o devolve depois de reordenar. */
  const focoRef = useRef<{ fotoId: string; direcao: -1 | 1 } | null>(null);

  // Constants derivadas
  const ordemAtual = fotos.map((f) => f.id).join(',');
  const emEdicao = editandoId ? fotos.find((f) => f.id === editandoId) : undefined;
  const removendoId = remover.isPending ? (remover.variables ?? null) : null;

  // Functions
  const limparMensagens = () => {
    setFeedback(null);
    setErro(null);
  };

  const handleMove = async (foto: Foto, direcao: -1 | 1) => {
    // Uma troca por vez: a seguinte parte da ordem já confirmada (ou revertida) pelo servidor.
    if (reordenar.isPending) return;
    const depois = moverFoto(fotos, foto.id, direcao);
    const lote = depois ? ordemAlterada(fotos, depois) : [];
    if (!depois || lote.length === 0) return;
    limparMensagens();
    focoRef.current = { fotoId: foto.id, direcao };
    const novaPosicao = depois.findIndex((f) => f.id === foto.id) + 1;
    setAviso(`Foto movida para a posição ${novaPosicao} de ${depois.length}.`);
    try {
      await reordenar.mutateAsync({ fotosDepois: depois, lote });
    } catch (e) {
      // A tela já voltou à ordem anterior (rollback); o foco volta ao botão que acionou.
      setAviso('');
      setErro(toMensagemErro(e, 'Não foi possível reordenar as fotos. A ordem anterior foi mantida.', NAO_ENCONTRADA));
    }
  };

  const handleEdit = (foto: Foto) => {
    limparMensagens();
    setConfirmandoId(null);
    setEditandoId(foto.id);
  };

  const handleCloseEdit = () => setEditandoId(null);

  const handleEdited = (mensagem: string) => {
    setEditandoId(null);
    setFeedback(mensagem);
  };

  const handleAskRemove = (foto: Foto) => {
    limparMensagens();
    setConfirmandoId(foto.id);
  };

  const handleCancelRemove = () => setConfirmandoId(null);

  const handleConfirmRemove = async (foto: Foto) => {
    limparMensagens();
    try {
      await remover.mutateAsync(foto.id);
      setConfirmandoId(null);
      setFeedback('Foto removida.');
    } catch (e) {
      setConfirmandoId(null);
      setErro(toMensagemErro(e, 'Não foi possível remover a foto. Tente novamente.', NAO_ENCONTRADA));
    }
  };

  // Effects (devolve o foco ao botão de mover; se a foto chegou à ponta, ao botão oposto)
  useEffect(() => {
    const alvo = focoRef.current;
    if (!alvo) return;
    focoRef.current = null;
    const preferido = document.getElementById(idBotaoMover(alvo.fotoId, alvo.direcao));
    const oposto = document.getElementById(idBotaoMover(alvo.fotoId, alvo.direcao === -1 ? 1 : -1));
    const botao = preferido instanceof HTMLButtonElement && !preferido.disabled ? preferido : oposto;
    botao?.focus();
  }, [ordemAtual]);

  // Retornos breves
  if (fotos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-7 text-center text-muted-foreground">
        <p className="text-[13px] font-medium text-foreground">Nenhuma foto neste relatório</p>
        <p className="mt-1 text-[13px]">Envie as fotos pela área acima.</p>
      </div>
    );
  }

  // Return
  return (
    <div className="flex flex-col gap-3">
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>
      {feedback && (
        <Alert variant="success" role="status">
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
      {erro && <ErroAlert erro={erro} />}

      <ul aria-label="Fotos do relatório" className="grid grid-cols-4 gap-3">
        {fotos.map((foto, indice) => (
          <FotoCard
            key={foto.id}
            foto={foto}
            posicao={indice + 1}
            total={fotos.length}
            confirmando={confirmandoId === foto.id}
            removendo={removendoId === foto.id}
            ocupado={remover.isPending}
            onMove={(f, direcao) => void handleMove(f, direcao)}
            onEdit={handleEdit}
            onAskRemove={handleAskRemove}
            onConfirmRemove={(f) => void handleConfirmRemove(f)}
            onCancelRemove={handleCancelRemove}
          />
        ))}
      </ul>

      {emEdicao && (
        <FotoEditDialog
          obraId={obraId}
          foto={emEdicao}
          posicao={fotos.findIndex((f) => f.id === emEdicao.id) + 1}
          onClose={handleCloseEdit}
          onSaved={handleEdited}
        />
      )}
    </div>
  );
};
