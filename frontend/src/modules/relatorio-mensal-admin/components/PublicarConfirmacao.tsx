import { Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface PublicarConfirmacaoProps {
  /** Título do relatório (ex.: "Setembro de 2026"). */
  titulo: string;
  /** Publicando: trava os botões. */
  ocupado: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação inline (o `alert-dialog` do shadcn não está instalado). O foco vai para "Cancelar" ao abrir. */
export const PublicarConfirmacao = ({ titulo, ocupado, onConfirm, onCancel }: PublicarConfirmacaoProps) => {
  // Hooks
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Effects
  useEffect(() => {
    cancelarRef.current?.focus();
  }, []);

  // Return
  return (
    <Alert variant="info">
      <Send aria-hidden />
      <AlertDescription>
        <p className="font-medium">Publicar para o cliente? Depois de publicado não pode ser editado nem excluído.</p>
        <p className="mt-0.5 truncate" title={titulo}>
          “{titulo}”. Será publicada a versão salva; o cliente da obra passa a ver este relatório.
        </p>
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" disabled={ocupado} onClick={onConfirm}>
            {ocupado ? 'Publicando…' : 'Publicar agora'}
          </Button>
          <Button ref={cancelarRef} type="button" size="sm" variant="outline" disabled={ocupado} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
