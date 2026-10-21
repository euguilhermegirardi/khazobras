import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { AnexosSecao } from './AnexosSecao';
import { LancamentoForm } from './LancamentoForm';

interface LancamentoFormDialogProps {
  obraId: string;
  /** Lançamento a editar (com os anexos mais recentes da lista); `null` = novo. */
  lancamento: LancamentoAdmin | null;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}

/** Diálogo de novo lançamento / edição (com comprovantes). Existe só enquanto aberto: cada abertura começa limpa. */
export const LancamentoFormDialog = ({ obraId, lancamento, onClose, onSaved }: LancamentoFormDialogProps) => {
  // Functions
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // Return
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{lancamento ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
          <DialogDescription>
            {lancamento
              ? 'Altere os dados e gerencie os comprovantes. Os comprovantes são salvos na hora; os dados, ao salvar.'
              : 'O lançamento nasce oculto para o cliente. Os comprovantes podem ser anexados depois de salvar, em Editar.'}
          </DialogDescription>
        </DialogHeader>
        {/* `key`: outro lançamento = formulário novo (os valores iniciais só valem na montagem). */}
        <LancamentoForm
          key={lancamento?.id ?? 'novo'}
          obraId={obraId}
          lancamento={lancamento}
          onCancel={onClose}
          onSaved={onSaved}
        />
        {lancamento && <AnexosSecao obraId={obraId} lancamentoId={lancamento.id} anexos={lancamento.anexos} />}
      </DialogContent>
    </Dialog>
  );
};
