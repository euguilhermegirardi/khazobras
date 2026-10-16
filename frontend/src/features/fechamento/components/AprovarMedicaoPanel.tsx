import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/shared/lib/apiClient'
import { formatCurrency } from '@/shared/lib/format'
import type { Medicao } from '@/shared/interfaces/medicao'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { useApproveMedicao } from '../hooks'

interface AprovarMedicaoPanelProps {
  medicao: Medicao
}

const MENSAGEM_ERRO = 'Não foi possível aprovar a medição. Tente novamente.'

/** Única ação de escrita do cliente: aprovar a medição, com confirmação (ação formal e sem volta). */
export const AprovarMedicaoPanel = ({ medicao }: AprovarMedicaoPanelProps) => {
  // Estados
  const [confirmando, setConfirmando] = useState(false)
  // Hooks
  const { mutate, isPending, isError, error, reset } = useApproveMedicao(medicao.obraId, medicao.id)
  // Constants derivadas
  const mensagemErro = error instanceof ApiError ? error.message : MENSAGEM_ERRO
  // Functions
  const handleAbrir = () => setConfirmando(true)
  const handleCancelar = () => {
    reset()
    setConfirmando(false)
  }
  const handleConfirmar = () => mutate()

  // Return
  if (!confirmando) {
    return (
      <Button onClick={handleAbrir}>Aprovar medição</Button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Alert variant="warning">
        <CircleAlert aria-hidden />
        <AlertTitle>Confirmar aprovação da medição {medicao.numero}?</AlertTitle>
        <AlertDescription>
          <p>
            Você está aprovando {formatCurrency(medicao.valorTotal)}. Depois da aprovação, a Khaz Engenharia poderá
            emitir a nota fiscal. Esta ação não pode ser desfeita.
          </p>
        </AlertDescription>
      </Alert>
      {isError && (
        <Alert variant="danger">
          <CircleAlert aria-hidden />
          <AlertDescription>
            <p>{mensagemErro}</p>
            {error instanceof ApiError && error.requestId && <p>Código para o suporte: {error.requestId}</p>}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button onClick={handleConfirmar} disabled={isPending}>
          {isPending ? 'Aprovando…' : 'Confirmar aprovação'}
        </Button>
        <Button variant="outline" onClick={handleCancelar} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
