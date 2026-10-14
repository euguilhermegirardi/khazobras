import { apiRequest } from '@/shared/lib/apiClient'
import type { AuthSession } from './types'

export function login(email: string, password: string): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/login', { method: 'POST', body: { email, password } })
}
