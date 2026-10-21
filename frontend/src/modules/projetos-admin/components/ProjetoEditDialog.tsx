import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useEtapas } from '@/hooks/useEtapas';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { ProjetoEditForm } from './ProjetoEditForm';

interface ProjetoEditDialogProps {
  obraId: string;
  projeto: ProjetoDocumento;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo de edição do nome, do tipo e da etapa de um documento. Existe só enquanto aberto. */
export const ProjetoEditDialog = ({ obraId, projeto, onClose, onSaved }: ProjetoEditDialogProps) => {
  // Hooks
  const { isPending: carregandoEtapas } = useEtapas(obraId);

  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>
            Altere o nome, o tipo e a etapa. O arquivo em si não muda: para trocá-lo, envie outro e exclua este.
          </DialogDescription>
        </DialogHeader>
        {carregandoEtapas ? (
          <div role="status" className="grid gap-3.5">
            <span className="sr-only">Carregando etapas…</span>
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        ) : (
          <ProjetoEditForm key={projeto.id} obraId={obraId} projeto={projeto} onCancel={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
};
