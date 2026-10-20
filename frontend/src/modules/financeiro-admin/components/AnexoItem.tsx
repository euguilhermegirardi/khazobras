import { Download, Paperclip, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LancamentoAnexo } from '@/interfaces/financeiro';
import { formatTimestamp } from '@/utils/dates';
import { formatBytes } from '@/utils/format';

interface AnexoItemProps {
  anexo: LancamentoAnexo;
  /** Este comprovante está sendo baixado agora. */
  baixando: boolean;
  /** Este comprovante está sendo removido agora. */
  removendo: boolean;
  /** Há uma operação de arquivo em andamento (envio, download ou remoção): trava as ações. */
  ocupado: boolean;
  onDownload: (anexo: LancamentoAnexo) => void;
  onRemove: (anexo: LancamentoAnexo) => void;
}

/** Um comprovante: nome, baixar e remover (com confirmação inline). Altura fixa (h-8) com ou sem confirmação. */
export const AnexoItem = ({ anexo, baixando, removendo, ocupado, onDownload, onRemove }: AnexoItemProps) => {
  // Estados
  const [confirmando, setConfirmando] = useState(false);

  // Constants derivadas
  const detalhe = [
    typeof anexo.tamanhoBytes === 'number' ? formatBytes(anexo.tamanhoBytes) : null,
    formatTimestamp(anexo.uploadedAt),
  ]
    .filter(Boolean)
    .join(' · ');

  // Functions
  const handleDownload = () => onDownload(anexo);
  const handleAskRemove = () => setConfirmando(true);
  const handleCancelRemove = () => setConfirmando(false);
  const handleConfirmRemove = () => onRemove(anexo);

  // Return
  return (
    <li className="flex h-9 items-center gap-2 border-b px-1 text-[13px] last:border-0">
      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={anexo.nomeArquivo}>
        {anexo.nomeArquivo}
        <span className="ml-2 text-[11px] text-muted-foreground">{detalhe}</span>
      </span>
      {confirmando ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[12px] text-danger">Remover este comprovante?</span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={ocupado}
            aria-label={`Confirmar remoção de ${anexo.nomeArquivo}`}
            onClick={handleConfirmRemove}
          >
            {removendo ? 'Removendo…' : 'Remover'}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={removendo} onClick={handleCancelRemove}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={ocupado}
            aria-label={`Baixar ${anexo.nomeArquivo}`}
            title={baixando ? 'Baixando…' : 'Baixar'}
            onClick={handleDownload}
          >
            <Download aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-danger hover:text-danger"
            disabled={ocupado}
            aria-label={`Remover ${anexo.nomeArquivo}`}
            title="Remover"
            onClick={handleAskRemove}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
};
