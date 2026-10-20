import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';

interface ExcluirRelatorioConfirmacaoProps {
  relatorio: RelatorioFotografico;
  /** Título exibido do relatório (ex.: "Setembro de 2026"). */
  titulo: string;
  /** Excluindo: trava os botões. */
  ocupado: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação inline (o `alert-dialog` do shadcn não está instalado). O foco vai para "Cancelar" ao abrir. */
export const ExcluirRelatorioConfirmacao = ({
  relatorio,
  titulo,
  ocupado,
  onConfirm,
  onCancel,
}: ExcluirRelatorioConfirmacaoProps) => {
  // Hooks
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Constants derivadas
  const quantidade = relatorio.quantidadeFotos ?? relatorio.fotos.length;
  const fotos = quantidade === 1 ? 'sua 1 foto' : `suas ${quantidade} fotos`;

  // Effects
  useEffect(() => {
    cancelarRef.current?.focus();
  }, [relatorio.id]);

  // Return
  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden />
      <AlertDescription>
        <p className="font-medium">Excluir definitivamente este relatório e {fotos}?</p>
        <p className="mt-0.5 truncate" title={titulo}>
          “{titulo}”. Não dá para desfazer.
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
