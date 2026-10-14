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

export const ADMIN_ROLES: readonly Role[] = ['Master', 'Admin']
export const CLIENT_ROLES: readonly Role[] = ['Client']
