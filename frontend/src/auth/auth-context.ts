import { createContext } from 'react'
import type { AuthSession } from '@/interfaces/auth'

export interface AuthContextValue {
  session: AuthSession | null
  signIn: (email: string, password: string) => Promise<AuthSession>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
