import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MedicaoForm } from './MedicaoForm';

interface MedicaoFormDialogProps {
  obraId: string;
  proximoNumero: number;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo largo com o formulário de nova medição. Existe só enquanto aberto: cada abertura começa limpa. */
export const MedicaoFormDialog = ({ obraId, proximoNumero, onClose, onSaved }: MedicaoFormDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Nova medição</DialogTitle>
          <DialogDescription>
            A medição nasce aguardando a aprovação do cliente. Depois de criada, não pode ser editada nem excluída.
          </DialogDescription>
        </DialogHeader>
        <MedicaoForm obraId={obraId} proximoNumero={proximoNumero} onCancel={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
};
