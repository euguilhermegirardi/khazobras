import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PagamentoForm } from './PagamentoForm';

interface PagamentoFormDialogProps {
  obraId: string;
  contratoId: string;
  /** Número do contrato, para o título e a mensagem de sucesso. */
  numeroContrato: string;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo de registro de pagamento de um contrato. Existe só enquanto aberto. */
export const PagamentoFormDialog = ({
  obraId,
  contratoId,
  numeroContrato,
  onClose,
  onSaved,
}: PagamentoFormDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Pagamento recebido no contrato {numeroContrato}. Depois de registrado, não pode ser editado nem excluído.
          </DialogDescription>
        </DialogHeader>
        <PagamentoForm
          obraId={obraId}
          contratoId={contratoId}
          numeroContrato={numeroContrato}
          onCancel={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
};
