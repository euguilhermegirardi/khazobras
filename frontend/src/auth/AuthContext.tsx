import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearSession, loadSession, onSessionCleared, saveSession } from '@/services/session'
import { login as loginRequest } from './api'
import { AuthContext } from './auth-context'
import type { AuthSession } from '@/interfaces/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())

  // 401 em qualquer chamada limpa a sessao fora do React; aqui o estado acompanha.
  // O cache do React Query também é limpo, para o próximo usuário do computador não ver dados do anterior.
  useEffect(
    () =>
      onSessionCleared(() => {
        setSession(null)
        queryClient.clear()
      }),
    [queryClient],
  )

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
