import { Link } from 'react-router-dom'

// O "← Minhas obras" de volta ao hub fica no AppShell (aparece em toda tela da obra).
export const ClientObraPage = () => <h1 className="text-xl font-semibold">Dashboard (em construção)</h1>
export const AdminDashboardPage = () => <h1 className="text-xl font-semibold">Dashboard (em construção)</h1>

export const ForbiddenPage = () => (
  <div className="p-6">
    <h1 className="text-xl font-semibold">Sem permissão</h1>
    <p className="mt-2">Você não tem acesso a esta área.</p>
    <Link to="/" className="mt-4 inline-block underline">Voltar ao início</Link>
  </div>
)

export const NotFoundPage = () => (
  <div className="p-6">
    <h1 className="text-xl font-semibold">Página não encontrada</h1>
    <Link to="/" className="mt-4 inline-block underline">Voltar ao início</Link>
  </div>
)
