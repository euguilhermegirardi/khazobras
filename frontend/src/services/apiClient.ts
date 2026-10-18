import { clearSession, loadSession } from '@/services/session'

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:5285').replace(/\/$/, '')

export type ApiErrorKind =
  | 'unauthorized' // 401: sessao invalida/expirada
  | 'forbidden' // 403: sem permissao
  | 'not_found' // 404
  | 'conflict' // 409: transicao de estado invalida
  | 'validation' // 400: erros de validacao
  | 'server' // 5xx: traz requestId
  | 'network'
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  /** Presente nos 500: o usuario informa ao suporte para consultar os logs. */
  readonly requestId?: string
  readonly fieldErrors?: Record<string, string[]>

  constructor(
    kind: ApiErrorKind,
    status: number,
    message: string,
    extra?: { requestId?: string; fieldErrors?: Record<string, string[]> },
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.requestId = extra?.requestId
    this.fieldErrors = extra?.fieldErrors
  }
}

type Json = Record<string, unknown> | unknown[]

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Json
  signal?: AbortSignal
}

function authHeaders(): Record<string, string> {
  const session = loadSession()
  return session ? { Authorization: `Bearer ${session.token}` } : {}
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: Record<string, unknown> = {}
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch {
    // corpo vazio ou nao-JSON
  }
  const message = typeof payload.message === 'string' ? payload.message : undefined

  switch (response.status) {
    case 400:
      return new ApiError('validation', 400, message ?? 'Dados inválidos.', {
        fieldErrors: payload.errors as Record<string, string[]> | undefined,
      })
    case 401:
      return new ApiError('unauthorized', 401, 'Sessão expirada. Entre novamente.')
    case 403:
      return new ApiError('forbidden', 403, 'Você não tem permissão para esta ação.')
    case 404:
      return new ApiError('not_found', 404, 'Não encontrado.')
    case 409:
      return new ApiError('conflict', 409, message ?? 'Esta ação não é permitida no estado atual.')
    default:
      if (response.status >= 500) {
        const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined
        return new ApiError('server', response.status, message ?? 'Erro no servidor.', { requestId })
      }
      return new ApiError('unknown', response.status, message ?? 'Erro inesperado.')
  }
}

async function send(path: string, options: RequestOptions, headers: Record<string, string>) {
  try {
    return await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: { ...headers, ...authHeaders() },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network', 0, 'Não foi possível conectar ao servidor.')
  }
}

async function handle(response: Response): Promise<Response> {
  if (response.ok) return response
  const error = await toApiError(response)
  // 401 encerra a sessao em qualquer tela (o AuthProvider reage ao evento).
  if (error.kind === 'unauthorized') clearSession()
  throw error
}

/** JSON in / JSON out. 204 devolve undefined. */
export async function apiRequest<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> =
    options.body === undefined ? {} : { 'Content-Type': 'application/json' }
  const response = await handle(await send(path, options, headers))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/**
 * Download autenticado (comprovantes, projetos): fetch com Bearer -> Blob.
 * Nunca link direto para o bucket (regra de seguranca nº 7).
 */
export async function apiDownload(path: string, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string | null }> {
  const response = await handle(await send(path, { signal }, {}))
  const disposition = response.headers.get('Content-Disposition')
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return { blob: await response.blob(), fileName: match?.[1] ? decodeFileName(match[1]) : null }
}

/** Nome malformado (ex.: "obra 100%.jpg") nao pode derrubar o download: cai no valor cru. */
function decodeFileName(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
