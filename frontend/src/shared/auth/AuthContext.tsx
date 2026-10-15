import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearSession, loadSession, onSessionCleared, saveSession } from '@/shared/lib/session'
import { login as loginRequest } from './api'
import { AuthContext } from './auth-context'
import type { AuthSession } from '@/shared/interfaces/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())

  // 401 em qualquer chamada limpa a sessao fora do React; aqui o estado acompanha.
  useEffect(() => onSessionCleared(() => setSession(null)), [])

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginRequest(email, password)
    saveSession(next)
    setSession(next)
    return next
  }, [])

  const signOut = useCallback(() => clearSession(), [])

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
