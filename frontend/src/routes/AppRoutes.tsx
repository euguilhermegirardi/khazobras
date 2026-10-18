import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathFor } from '@/auth/homePath'
import { useAuth } from '@/auth/useAuth'
import { LoginPage } from '@/modules/auth/LoginPage'
import { ADMIN_ROLES, CLIENT_ROLES } from '@/auth/roles'
import { FechamentoDetalhePage } from '@/modules/fechamento/pages/FechamentoDetalhePage'
import { FechamentoPage } from '@/modules/fechamento/pages/FechamentoPage'
import { FinanceiroPage } from '@/modules/financeiro/pages/FinanceiroPage'
import { ObraHubPage } from '@/modules/obras/pages/ObraHubPage'
import { RelatorioFotograficoPage } from '@/modules/relatorio-fotografico/pages/RelatorioFotograficoPage'
import { RelatorioMensalPage } from '@/modules/relatorio-mensal/pages/RelatorioMensalPage'
import { AdminLayout, ClientLayout } from '@/layouts/RoleLayouts'
import { AdminDashboardPage, ClientObraPage, ForbiddenPage, NotFoundPage } from './pages'
import { ProtectedRoute } from './ProtectedRoute'

const RootRedirect = () => {
  const { session } = useAuth()
  return <Navigate to={session ? homePathFor(session.role) : '/login'} replace />
}

export const AppRoutes = () => {
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
          <Route
            path="/cliente/obras/:obraId/fechamento"
            element={<FechamentoPage medicaoPath={(obraId, id) => `/cliente/obras/${obraId}/fechamento/${id}`} />}
          />
          <Route
            path="/cliente/obras/:obraId/fechamento/:medicaoId"
            element={<FechamentoDetalhePage listaPath={(obraId) => `/cliente/obras/${obraId}/fechamento`} />}
          />
          <Route path="/cliente/obras/:obraId/financeiro" element={<FinanceiroPage />} />
          <Route path="/cliente/obras/:obraId/relatorio-fotografico" element={<RelatorioFotograficoPage />} />
          <Route path="/cliente/obras/:obraId/relatorio-mensal" element={<RelatorioMensalPage />} />
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
