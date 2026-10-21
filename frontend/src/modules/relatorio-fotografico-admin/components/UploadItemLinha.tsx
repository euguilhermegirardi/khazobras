import { ImageOff } from 'lucide-react';
import { UploadItemLinha as UploadItemLinhaBase } from '@/components/UploadItemLinha';
import type { UploadItem } from '@/utils/uploadFila';
import { useArquivoLocalUrl } from '../hooks';

interface UploadItemLinhaProps {
  item: UploadItem;
  onRemove: (id: string) => void;
}

/** Linha da fila de fotos: a base, com a pré-visualização local da imagem como miniatura. */
export const UploadItemLinha = ({ item, onRemove }: UploadItemLinhaProps) => {
  // Hooks
  const previa = useArquivoLocalUrl(item.file);

  // Return
  return (
    <UploadItemLinhaBase
      item={item}
      onRemove={onRemove}
      miniatura={
        previa ? (
          <img
            src={previa}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-9 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-neutral-soft-foreground">
            <ImageOff aria-hidden className="size-4" />
          </div>
        )
      }
    />
  );
};
