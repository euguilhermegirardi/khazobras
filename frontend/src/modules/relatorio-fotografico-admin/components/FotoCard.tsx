import { ArrowLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { FotoMiniatura } from '@/components/FotoMiniatura';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { formatDateOnly } from '@/utils/dates';
import { idBotaoMover, nomeDaFoto } from '../fotoNome';

interface FotoCardProps {
  foto: Foto;
  /** Posição no relatório, a partir de 1. */
  posicao: number;
  total: number;
  /** Pedindo confirmação para remover esta foto (a linha de ações vira "Remover? Remover / Cancelar"). */
  confirmando: boolean;
  /** Removendo agora: trava os botões da confirmação. */
  removendo: boolean;
  /** Outra ação (editar, remover) em andamento: trava editar/remover. */
  ocupado: boolean;
  onMove: (foto: Foto, direcao: -1 | 1) => void;
  onEdit: (foto: Foto) => void;
  onAskRemove: (foto: Foto) => void;
  onConfirmRemove: (foto: Foto) => void;
  onCancelRemove: () => void;
}

/**
 * Uma foto do relatório: imagem 4:3, descrição e data numa área de altura fixa (uma linha cada, truncadas) e uma
 * linha de ações de 28px. Altura igual em todos os cartões, com ou sem descrição, data ou confirmação aberta.
 */
export const FotoCard = ({
  foto,
  posicao,
  total,
  confirmando,
  removendo,
  ocupado,
  onMove,
  onEdit,
  onAskRemove,
  onConfirmRemove,
  onCancelRemove,
}: FotoCardProps) => {
  // Hooks
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Constants derivadas
  const descricao = foto.descricao?.trim() || null;
  const data = foto.dataFoto ? formatDateOnly(foto.dataFoto) : null;
  const nome = nomeDaFoto(foto, posicao);
  const legenda = [descricao, data].filter(Boolean).join(' · ');

  // Functions
  const handleLeft = () => onMove(foto, -1);
  const handleRight = () => onMove(foto, 1);
  const handleEdit = () => onEdit(foto);
  const handleAskRemove = () => onAskRemove(foto);
  const handleConfirmRemove = () => onConfirmRemove(foto);

  // Effects (a confirmação abre com o foco no botão seguro)
  useEffect(() => {
    if (confirmando) cancelarRef.current?.focus();
  }, [confirmando]);

  // Return
  return (
    <li>
      <Card className="h-full gap-2 p-2">
        <FotoMiniatura fotoId={foto.id} alt={descricao ?? `Foto ${posicao}`} legenda={legenda} />
        <div className="flex h-9 flex-col justify-center px-0.5">
          <p
            className={descricao ? 'truncate text-[13px]' : 'truncate text-[13px] text-muted-foreground'}
            title={descricao ?? undefined}
          >
            {descricao ?? 'Sem descrição'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{data ?? 'Sem data'}</p>
        </div>

        {confirmando ? (
          <div role="group" aria-label={`Confirmar a remoção da ${nome}`} className="flex h-7 items-center gap-1.5">
            <span className="mr-auto text-[11px] font-medium">Remover?</span>
            <Button type="button" size="sm" variant="destructive" disabled={removendo} onClick={handleConfirmRemove}>
              {removendo ? 'Removendo…' : 'Remover'}
            </Button>
            <Button
              ref={cancelarRef}
              type="button"
              size="sm"
              variant="outline"
              disabled={removendo}
              onClick={onCancelRemove}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex h-7 items-center gap-1">
            <span className="mr-auto text-[11px] text-muted-foreground" aria-hidden="true">
              {posicao} de {total}
            </span>
            <Button
              id={idBotaoMover(foto.id, -1)}
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              disabled={posicao === 1}
              aria-label={`Mover a ${nome} para a esquerda`}
              title="Mover para a esquerda"
              onClick={handleLeft}
            >
              <ArrowLeft aria-hidden />
            </Button>
            <Button
              id={idBotaoMover(foto.id, 1)}
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              disabled={posicao === total}
              aria-label={`Mover a ${nome} para a direita`}
              title="Mover para a direita"
              onClick={handleRight}
            >
              <ArrowRight aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7"
              disabled={ocupado}
              aria-label={`Editar a ${nome}`}
              title="Editar descrição e data"
              onClick={handleEdit}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-7 text-danger"
              disabled={ocupado}
              aria-label={`Remover a ${nome}`}
              title="Remover foto"
              onClick={handleAskRemove}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
};
