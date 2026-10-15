import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'

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
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
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
