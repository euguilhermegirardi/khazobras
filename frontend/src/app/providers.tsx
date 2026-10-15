import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/shared/auth/AuthContext'
import { ApiError } from '@/shared/lib/apiClient'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // So tenta de novo em falha de rede/servidor; 4xx e decisao do backend.
            retry: (count, error) =>
              count < 2 && error instanceof ApiError && (error.kind === 'network' || error.kind === 'server'),
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
