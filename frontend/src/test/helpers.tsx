import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/AppRoutes'
import { AuthProvider } from '@/shared/auth/AuthContext'
import type { AuthSession, Role } from '@/shared/interfaces/auth'
import { saveSession } from '@/shared/lib/session'

export function fakeSession(role: Role): AuthSession {
  return {
    token: 'token-falso-de-teste',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    userId: '11111111-1111-1111-1111-111111111111',
    name: `Usuário ${role}`,
    email: `${role.toLowerCase()}@example.com`,
    role,
  }
}

export function renderApp(path: string, role?: Role) {
  if (role) saveSession(fakeSession(role))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
