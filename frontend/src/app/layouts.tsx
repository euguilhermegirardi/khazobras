import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'

function Shell({ title }: { title: string }) {
  const { session, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <strong>{title}</strong>
        <div className="flex items-center gap-4 text-sm">
          <span>{session?.name}</span>
          <button type="button" onClick={signOut} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100">
            Sair
          </button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}

// Navbar do SPEC §5 (cliente) e §6 (admin/master) entra aqui, tela a tela.
export const ClientLayout = () => <Shell title="KhazObras — Minha obra" />
export const AdminLayout = () => <Shell title="KhazObras — Gestão" />
