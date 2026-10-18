import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import type { Role } from '@/interfaces/auth'

/**
 * Guarda de rota por papel. Atencao: isto e conveniencia de navegacao, NAO controle de acesso.
 * Quem decide e o backend (403). O cliente nunca monta componentes de admin.
 */
interface ProtectedRouteProps {
  allow: readonly Role[]
}

export const ProtectedRoute = ({ allow }: ProtectedRouteProps) => {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!allow.includes(session.role)) return <Navigate to="/sem-permissao" replace />
  return <Outlet />
}
