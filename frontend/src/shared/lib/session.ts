import type { AuthSession } from '@/shared/interfaces/auth'

// Decisao V1: sessionStorage (nao localStorage). O JWT dura 8h e nao ha refresh.
// Trade-off: sobrevive ao recarregar a pagina, mas nao ao fechar a aba.
// Todo acesso ao storage e protegido: pode lancar em janela privada ou com dados bloqueados.
const KEY = 'khazobras.session'

const listeners = new Set<() => void>()

export function loadSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    if (!session.token || new Date(session.expiresAt).getTime() <= Date.now()) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Sem storage: a sessao vive apenas em memoria (AuthProvider).
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignora
  }
  listeners.forEach((listener) => listener())
}

/** Avisa quando a sessao e encerrada fora do React (ex.: 401 no apiClient). */
export function onSessionCleared(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
