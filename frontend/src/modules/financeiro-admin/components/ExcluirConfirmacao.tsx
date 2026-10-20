import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { formatCurrency } from '@/utils/format';

interface ExcluirConfirmacaoProps {
  lancamento: LancamentoAdmin;
  /** Excluindo: trava os botões. */
  ocupado: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação inline (o `alert-dialog` do shadcn não está instalado). O foco vai para "Cancelar" ao abrir. */
export const ExcluirConfirmacao = ({ lancamento, ocupado, onConfirm, onCancel }: ExcluirConfirmacaoProps) => {
  // Hooks
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Effects
  useEffect(() => {
    cancelarRef.current?.focus();
  }, [lancamento.id]);

  // Return
  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden />
      <AlertDescription>
        <p className="font-medium">
          Excluir definitivamente “{lancamento.descricao}” ({formatCurrency(lancamento.valor)})? Os comprovantes também
          serão removidos.
        </p>
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="destructive" disabled={ocupado} onClick={onConfirm}>
            {ocupado ? 'Excluindo…' : 'Excluir definitivamente'}
          </Button>
          <Button ref={cancelarRef} type="button" size="sm" variant="outline" disabled={ocupado} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
