import { Download, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import type { ProjetoDocumento } from '@/interfaces/projeto'
import { formatTimestamp } from '@/utils/dates'
import { ARQUIVO_ICONE, ARQUIVO_ROTULO, arquivoTipo, podeVisualizar } from '../constants'
import type { ProjetoAcao } from '../hooks'

interface ProjetoLinhaProps {
  projeto: ProjetoDocumento
  /** Id do projeto em visualização/download (null = nenhum). */
  ocupadoId: string | null
  onAcao: (projeto: ProjetoDocumento, acao: ProjetoAcao) => void
}

export const ProjetoLinha = ({ projeto, ocupadoId, onAcao }: ProjetoLinhaProps) => {
  // Constants derivadas
  const tipo = arquivoTipo(projeto.nome)
  const Icone = ARQUIVO_ICONE[tipo]
  const ocupado = ocupadoId === projeto.id

  // Functions
  const handleVisualizar = () => onAcao(projeto, 'visualizar')
  const handleBaixar = () => onAcao(projeto, 'baixar')

  // Return
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Icone className="size-4 shrink-0 text-muted-foreground" aria-label={ARQUIVO_ROTULO[tipo]} role="img" />
          <span className="break-all">{projeto.nome}</span>
        </div>
      </TableCell>
      <TableCell>
        {projeto.tipoDocumento ? (
          <Badge variant="neutral">{projeto.tipoDocumento}</Badge>
        ) : (
          <span className="text-muted-foreground" aria-label="Sem tipo">
            —
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{formatTimestamp(projeto.uploadedAt)}</TableCell>
      <TableCell>
        {/* Altura fixa (h-7 = botão sm) com ou sem "Visualizar", para as linhas ficarem iguais */}
        <div className="flex h-7 items-center justify-end gap-2">
          {podeVisualizar(projeto.nome) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ocupado}
              aria-label={`Visualizar ${projeto.nome}`}
              onClick={handleVisualizar}
            >
              <Eye aria-hidden />
              Visualizar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocupado}
            aria-label={`Baixar ${projeto.nome}`}
            onClick={handleBaixar}
          >
            <Download aria-hidden />
            Baixar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
