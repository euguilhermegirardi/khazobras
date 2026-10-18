import { Paperclip } from 'lucide-react'
import type { LancamentoAnexo } from '@/interfaces/financeiro'
import { Button } from '@/components/ui/button'

interface ComprovanteButtonProps {
  anexo: LancamentoAnexo
  /** Este comprovante está sendo baixado agora. */
  baixando: boolean
  onDownload: (anexo: LancamentoAnexo) => void
}

export const ComprovanteButton = ({ anexo, baixando, onDownload }: ComprovanteButtonProps) => {
  // Functions
  const handleClick = () => onDownload(anexo)

  // Return
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      disabled={baixando}
      aria-label={`Baixar comprovante ${anexo.nomeArquivo}`}
      title={anexo.nomeArquivo}
      onClick={handleClick}
    >
      <Paperclip aria-hidden />
    </Button>
  )
}
