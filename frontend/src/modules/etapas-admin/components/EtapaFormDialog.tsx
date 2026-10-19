import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { EtapaForm } from './EtapaForm';

interface EtapaFormDialogProps {
  obraId: string;
  /** Etapa em edição; null = criação. */
  etapa: EtapaCronograma | null;
  proximaOrdem: number;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo com o formulário da etapa. Existe só enquanto aberto: cada abertura começa com os valores da etapa. */
export const EtapaFormDialog = ({ obraId, etapa, proximaOrdem, onClose, onSaved }: EtapaFormDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{etapa ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
          <DialogDescription>
            {etapa
              ? 'Ajuste prazos, avanço e status. O cliente vê a alteração no cronograma dele.'
              : 'A etapa nasce não iniciada, com 0%. Depois de criada, edite o avanço e as datas reais.'}
          </DialogDescription>
        </DialogHeader>
        <EtapaForm obraId={obraId} etapa={etapa} proximaOrdem={proximaOrdem} onCancel={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
};
