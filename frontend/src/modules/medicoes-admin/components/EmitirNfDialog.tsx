import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmitirNfForm } from './EmitirNfForm';

interface EmitirNfDialogProps {
  obraId: string;
  medicaoId: string;
  /** Número da medição, só para o texto do diálogo. */
  numero: number;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo de emissão da NF de uma medição aprovada. Existe só enquanto aberto. */
export const EmitirNfDialog = ({ obraId, medicaoId, numero, onClose, onSaved }: EmitirNfDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emitir NF</DialogTitle>
          <DialogDescription>
            Informe o número da nota fiscal da medição {numero}. Depois de emitida, a NF não pode ser alterada.
          </DialogDescription>
        </DialogHeader>
        <EmitirNfForm obraId={obraId} medicaoId={medicaoId} onCancel={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
};
