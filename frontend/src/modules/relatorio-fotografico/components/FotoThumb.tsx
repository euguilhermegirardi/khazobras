import { FotoMiniatura } from '@/components/FotoMiniatura';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { formatDateOnly } from '@/utils/dates';

interface FotoThumbProps {
  foto: Foto;
}

export const FotoThumb = ({ foto }: FotoThumbProps) => {
  // Constants derivadas
  const descricao = foto.descricao?.trim() || null;
  const data = foto.dataFoto ? formatDateOnly(foto.dataFoto) : null;
  const alt = descricao ?? 'Foto da obra';
  const legenda = [descricao, data].filter(Boolean).join(' · ');

  // Return
  return (
    <figure className="flex flex-col gap-1.5">
      <FotoMiniatura fotoId={foto.id} alt={alt} legenda={legenda} />
      {legenda && <figcaption className="text-xs text-muted-foreground">{legenda}</figcaption>}
    </figure>
  );
};
