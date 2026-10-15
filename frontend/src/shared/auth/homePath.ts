import type { Role } from '@/shared/interfaces/auth'

export function homePathFor(role: Role): string {
  return role === 'Client' ? '/cliente' : '/admin'
}
