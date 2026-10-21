import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/format';
import type { UploadItem, UploadStatus } from '@/utils/uploadFila';

interface UploadItemLinhaProps {
  item: UploadItem;
  /** Quadrado de 36px à esquerda: pré-visualização da imagem ou ícone do tipo de arquivo. */
  miniatura: ReactNode;
  onRemove: (id: string) => void;
}

const STATUS_BADGE: Record<UploadStatus, { label: string; variant: 'neutral' | 'info' | 'success' | 'danger' }> = {
  pendente: { label: 'Pendente', variant: 'neutral' },
  enviando: { label: 'Enviando…', variant: 'info' },
  enviada: { label: 'Enviada', variant: 'success' },
  erro: { label: 'Erro', variant: 'danger' },
  cancelada: { label: 'Cancelada', variant: 'neutral' },
};

/**
 * Uma linha da fila de envio (48px, sempre): miniatura, nome do arquivo (texto, truncado), tamanho ou a mensagem de
 * erro do servidor, e o status. O nome nunca é interpretado como HTML.
 */
export const UploadItemLinha = ({ item, miniatura, onRemove }: UploadItemLinhaProps) => {
  // Constants derivadas
  const status = STATUS_BADGE[item.status];
  const detalhe = item.status === 'erro' && item.erro ? item.erro : formatBytes(item.file.size);

  // Functions
  const handleRemove = () => onRemove(item.id);

  // Return
  return (
    <li className="flex h-12 items-center gap-2.5 border-b px-2.5 last:border-b-0">
      {miniatura}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight" title={item.file.name}>
          {item.file.name}
        </p>
        <p
          className={
            item.status === 'erro'
              ? 'line-clamp-1 text-[11px] leading-tight text-danger'
              : 'truncate text-[11px] leading-tight text-muted-foreground'
          }
          title={detalhe}
        >
          {detalhe}
        </p>
      </div>
      <Badge variant={status.variant}>{status.label}</Badge>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        disabled={item.status === 'enviando'}
        aria-label={`Tirar ${item.file.name} da lista`}
        onClick={handleRemove}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
};
