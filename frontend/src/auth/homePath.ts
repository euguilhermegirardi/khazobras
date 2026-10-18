import type { Role } from '@/interfaces/auth'

export function homePathFor(role: Role): string {
  return role === 'Client' ? '/cliente' : '/admin'
}
