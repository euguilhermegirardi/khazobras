import { apiRequest } from '@/services/apiClient';
import type { AuthSession } from '@/interfaces/auth';

export function login(email: string, password: string): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/login', { method: 'POST', body: { email, password } });
}
