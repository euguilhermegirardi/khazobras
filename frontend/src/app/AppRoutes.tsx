import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathFor } from '@/shared/auth/homePath'
import { useAuth } from '@/shared/auth/useAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { ADMIN_ROLES, CLIENT_ROLES } from '@/shared/auth/types'
import { ObraHubPage } from '@/features/obras/pages/ObraHubPage'
import { AdminLayout, ClientLayout } from './layouts'
import { AdminDashboardPage, ClientObraPage, ForbiddenPage, NotFoundPage } from './pages'
import { ProtectedRoute } from './ProtectedRoute'

function RootRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? homePathFor(session.role) : '/login'} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sem-permissao" element={<ForbiddenPage />} />

      {/* Visao CLIENTE (SPEC §5) */}
      <Route element={<ProtectedRoute allow={CLIENT_ROLES} />}>
        <Route element={<ClientLayout />}>
          <Route path="/cliente" element={<ObraHubPage obraPath={(id) => `/cliente/obras/${id}`} />} />
          <Route path="/cliente/obras/:obraId" element={<ClientObraPage />} />
        </Route>
      </Route>

      {/* Visao ADMIN / MASTER (SPEC §6) */}
      <Route element={<ProtectedRoute allow={ADMIN_ROLES} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
