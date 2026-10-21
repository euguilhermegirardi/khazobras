import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { FotoEditForm } from './FotoEditForm';

interface FotoEditDialogProps {
  obraId: string;
  foto: Foto;
  /** Posição da foto no relatório (1 = primeira), só para o título do diálogo. */
  posicao: number;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo de edição da descrição e da data de uma foto. Existe só enquanto aberto. */
export const FotoEditDialog = ({ obraId, foto, posicao, onClose, onSaved }: FotoEditDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar foto {posicao}</DialogTitle>
          <DialogDescription>
            Altere a descrição e a data. Para mudar a posição, use as setas da foto.
          </DialogDescription>
        </DialogHeader>
        <FotoEditForm key={foto.id} obraId={obraId} foto={foto} onCancel={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
};
