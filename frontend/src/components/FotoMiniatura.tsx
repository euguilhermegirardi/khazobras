import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { ImageDialog } from '@/components/ImageDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthenticatedObjectUrl } from '@/hooks/useAuthenticatedObjectUrl';

interface FotoMiniaturaProps {
  fotoId: string;
  /** Texto alternativo (descrição da foto ou "Foto da obra"). */
  alt: string;
  /** Legenda da imagem ampliada. */
  legenda?: string;
}

/**
 * Imagem 4:3 de uma foto do relatório fotográfico: baixa pelo endpoint autenticado (Bearer -> blob), mostra
 * esqueleto enquanto carrega, "Imagem indisponível" se falhar e amplia em diálogo ao clicar. Nunca URL pública.
 */
export const FotoMiniatura = ({ fotoId, alt, legenda }: FotoMiniaturaProps) => {
  // Estados
  const [aberta, setAberta] = useState(false);
  // Hooks
  const { url, isLoading, isError } = useAuthenticatedObjectUrl(`/fotos/${fotoId}/arquivo`);

  // Functions
  const handleOpen = () => setAberta(true);
  const handleClose = () => setAberta(false);

  // Return
  return (
    <>
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
      {aberta && url && <ImageDialog src={url} alt={alt} caption={legenda || undefined} onClose={handleClose} />}
    </>
  );
};
