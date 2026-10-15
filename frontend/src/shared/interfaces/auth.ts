export type Role = 'Master' | 'Admin' | 'Client'

/** Resposta de POST /auth/login. */
export interface AuthSession {
  token: string
  expiresAt: string
  userId: string
  name: string
  email: string
  role: Role
}
