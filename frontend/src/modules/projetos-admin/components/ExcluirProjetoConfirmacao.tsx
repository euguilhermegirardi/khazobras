import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ProjetoDocumento } from '@/interfaces/projeto';

interface ExcluirProjetoConfirmacaoProps {
  projeto: ProjetoDocumento;
  /** Excluindo: trava os botões. */
  ocupado: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação inline (o `alert-dialog` do shadcn não está instalado). O foco vai para "Cancelar" ao abrir. */
export const ExcluirProjetoConfirmacao = ({
  projeto,
  ocupado,
  onConfirm,
  onCancel,
}: ExcluirProjetoConfirmacaoProps) => {
  // Hooks
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Effects
  useEffect(() => {
    cancelarRef.current?.focus();
  }, [projeto.id]);

  // Return
  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden />
      <AlertDescription>
        <p className="line-clamp-2 font-medium break-all" title={projeto.nome}>
          Excluir definitivamente o documento {projeto.nome}?
        </p>
        <p className="mt-0.5">O arquivo sai do sistema e o cliente deixa de vê-lo. Não dá para desfazer.</p>
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
