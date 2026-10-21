import { Upload } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface UploadDropzoneProps {
  id: string;
  /** Atributo `accept` do `<input type="file">`. */
  accept: string;
  /** Destino cheio: trava o campo e a soltura de arquivos. */
  disabled: boolean;
  /** Texto da área quando dá para enviar. */
  texto: string;
  /** Texto da área quando `disabled`. */
  textoDesabilitado: string;
  /** Linha de ajuda sob a área (tamanho, tipos, quantos já existem). */
  ajuda: ReactNode;
  onFiles: (arquivos: File[]) => void;
}

/**
 * Área de soltar/escolher arquivos (`.upload-zone` do protótipo). Soltar é só um atalho: o teclado e o leitor de tela
 * usam o input de arquivo da mesma label (o foco do input aparece no contorno da área).
 */
export const UploadDropzone = ({
  id,
  accept,
  disabled,
  texto,
  textoDesabilitado,
  ajuda,
  onFiles,
}: UploadDropzoneProps) => {
  // Estados
  const [arrastando, setArrastando] = useState(false);

  // Functions
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const arquivos = Array.from(input.files ?? []);
    // Limpa o campo: escolher o mesmo arquivo de novo (depois de tirá-lo da lista) dispara o evento outra vez.
    input.value = '';
    if (arquivos.length > 0) onFiles(arquivos);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastando(true);
  };

  const handleDragLeave = () => setArrastando(false);

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (disabled) return;
    const arquivos = Array.from(e.dataTransfer.files);
    if (arquivos.length > 0) onFiles(arquivos);
  };

  // Return
  return (
    <div>
      <input
        id={id}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        aria-describedby={`${id}-ajuda`}
        className="peer sr-only"
        onChange={handleChange}
      />
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <label
        htmlFor={id}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed bg-card p-5 text-center text-[13px] text-muted-foreground outline-none hover:bg-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:hover:bg-card peer-disabled:[&>svg]:opacity-50',
          arrastando && 'border-primary bg-info-soft text-info-soft-foreground',
        )}
      >
        <Upload aria-hidden className="size-6" />
        <span>{disabled ? textoDesabilitado : texto}</span>
      </label>
      <p id={`${id}-ajuda`} className="mt-1.5 text-[11px] text-muted-foreground">
        {ajuda}
      </p>
    </div>
  );
};
