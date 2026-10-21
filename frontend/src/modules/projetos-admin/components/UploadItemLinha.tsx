import { UploadItemLinha as UploadItemLinhaBase } from '@/components/UploadItemLinha';
import { ARQUIVO_ICONE, arquivoTipo } from '@/utils/arquivoTipo';
import type { UploadItem } from '@/utils/uploadFila';

interface UploadItemLinhaProps {
  item: UploadItem;
  onRemove: (id: string) => void;
}

/** Linha da fila de documentos: a base, com o ícone do tipo do arquivo como miniatura (documento não tem prévia). */
export const UploadItemLinha = ({ item, onRemove }: UploadItemLinhaProps) => {
  // Constants derivadas
  const Icone = ARQUIVO_ICONE[arquivoTipo(item.file.name)];

  // Return
  return (
    <UploadItemLinhaBase
      item={item}
      onRemove={onRemove}
      miniatura={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-neutral-soft-foreground">
          <Icone aria-hidden className="size-4" />
        </div>
      }
    />
  );
};
