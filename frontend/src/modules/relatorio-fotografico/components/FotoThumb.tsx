import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { ImageDialog } from '@/components/ImageDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthenticatedObjectUrl } from '@/hooks/useAuthenticatedObjectUrl';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { formatDateOnly } from '@/utils/dates';

interface FotoThumbProps {
  foto: Foto;
}

export const FotoThumb = ({ foto }: FotoThumbProps) => {
  // Estados
  const [aberta, setAberta] = useState(false);
  // Hooks
  const { url, isLoading, isError } = useAuthenticatedObjectUrl(`/fotos/${foto.id}/arquivo`);
  // Constants derivadas
  const descricao = foto.descricao?.trim() || null;
  const data = foto.dataFoto ? formatDateOnly(foto.dataFoto) : null;
  const alt = descricao ?? 'Foto da obra';
  const legenda = [descricao, data].filter(Boolean).join(' · ');

  // Functions
  const handleOpen = () => setAberta(true);
  const handleClose = () => setAberta(false);

  // Return
  return (
    <figure className="flex flex-col gap-1.5">
      {isLoading && <Skeleton className="aspect-4/3 w-full rounded-md" />}
      {!isLoading && (isError || !url) && (
        <div
          role="img"
          aria-label={`${alt} (imagem indisponível)`}
          className="flex aspect-4/3 w-full flex-col items-center justify-center gap-1 rounded-md bg-neutral-soft text-[11px] text-neutral-soft-foreground"
        >
          <ImageOff aria-hidden="true" className="size-5" />
          Imagem indisponível
        </div>
      )}
      {!isLoading && !isError && url && (
        <button
          type="button"
          aria-label={`Ampliar foto: ${alt}`}
          onClick={handleOpen}
          className="overflow-hidden rounded-md border outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <img src={url} alt={alt} className="aspect-4/3 w-full object-cover" />
        </button>
      )}
      {legenda && <figcaption className="text-xs text-muted-foreground">{legenda}</figcaption>}
      {aberta && url && <ImageDialog src={url} alt={alt} caption={legenda || undefined} onClose={handleClose} />}
    </figure>
  );
};
