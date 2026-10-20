import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useEtapas } from '@/hooks/useEtapas';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { RelatorioForm } from './RelatorioForm';

interface RelatorioFormDialogProps {
  obraId: string;
  /** Relatório a editar; `null` = novo. */
  relatorio: RelatorioFotografico | null;
  onClose: () => void;
  onSaved: (mensagem: string, salvo: RelatorioFotografico) => void;
}

/** Diálogo de novo relatório / edição dos dados (tipo, etapa, título, competência). Existe só enquanto aberto. */
export const RelatorioFormDialog = ({ obraId, relatorio, onClose, onSaved }: RelatorioFormDialogProps) => {
  // Hooks
  const { isPending: carregandoEtapas } = useEtapas(obraId);

  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{relatorio ? 'Editar relatório' : 'Novo relatório fotográfico'}</DialogTitle>
          <DialogDescription>
            {relatorio
              ? 'Altere os dados do relatório. As fotos são gerenciadas na própria página do relatório.'
              : 'Depois de criar, abra o relatório para enviar as fotos. O cliente da obra vê todos os relatórios.'}
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
          <RelatorioForm
            key={relatorio?.id ?? 'novo'}
            obraId={obraId}
            relatorio={relatorio}
            onCancel={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
