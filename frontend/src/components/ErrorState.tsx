import { ApiError } from '@/services/apiClient'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  error: unknown
  /** Mensagem quando o erro não é da API (ex.: falha inesperada). */
  fallbackMessage: string
  onRetry: () => void
}

/** Estado de erro padrão das telas: mensagem, requestId nos 500 e "Tentar novamente". */
export const ErrorState = ({ error, fallbackMessage, onRetry }: ErrorStateProps) => {
  const apiError = error instanceof ApiError ? error : null

  return (
    <div role="alert" className="rounded-md border border-danger/25 bg-danger-soft p-4 text-[13px] text-danger-soft-foreground">
      <p>{apiError?.message ?? fallbackMessage}</p>
      {apiError?.requestId && (
        <p className="mt-1 text-sm text-muted-foreground">Código para o suporte: {apiError.requestId}</p>
      )}
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}
