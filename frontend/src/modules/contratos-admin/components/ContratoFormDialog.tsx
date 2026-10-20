import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContratoForm } from './ContratoForm';

interface ContratoFormDialogProps {
  obraId: string;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo do novo contrato. Existe só enquanto aberto: cada abertura começa limpa. */
export const ContratoFormDialog = ({ obraId, onClose, onSaved }: ContratoFormDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            O número não pode se repetir na obra. Depois de criado, o contrato não pode ser editado nem excluído.
          </DialogDescription>
        </DialogHeader>
        <ContratoForm obraId={obraId} onCancel={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
};
