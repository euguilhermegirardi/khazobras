import { Outlet } from 'react-router-dom'
import { useAuth } from '@/shared/auth/useAuth'
import { Button } from '@/shared/ui/button'

function Shell({ title }: { title: string }) {
  const { session, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <strong>{title}</strong>
        <div className="flex items-center gap-4 text-sm">
          <span>{session?.name}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sair
          </Button>
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
