import { ArrowLeft, Building, Building2, LogOut } from 'lucide-react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { EMPRESA, type NavConfig } from '../navigation';
import { SidebarBlock } from './SidebarBlock';
import { SidebarLink } from './SidebarLink';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  nav: NavConfig;
  /** Padrão de rota da obra aberta (ex.: `/cliente/obras/:obraId/*`). */
  obraRoute: string;
}

/**
 * Moldura das telas logadas, igual ao protótipo (docs/design/capturas/dashboard.png):
 * sidebar branca de 210px (logo, Hub, bloco da obra em azul, bloco da empresa em verde) +
 * topbar branca fixa + conteúdo sobre fundo cinza com padding de 20px.
 */
export const AppShell = ({ nav, obraRoute }: AppShellProps) => {
  // Hooks
  const { session, signOut } = useAuth();
  const obraMatch = useMatch(obraRoute);

  // Constants derivadas
  const obraId = obraMatch?.params.obraId;
  const resolve = (to: string) => (obraId ? to.replace(':obraId', obraId) : to);
  const EmpresaIcon = EMPRESA.icon;

  // Return
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[210px] shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar sm:block">
        <div className="mb-1.5 border-b border-sidebar-border px-4 pt-[18px] pb-3.5">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Building2 aria-hidden className="size-[18px] text-primary" />
            Khaz Obras
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Gerenciamento de obras</p>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-col gap-1">
          <div className="mx-1.5 mb-2.5 rounded-md bg-muted [&_a]:rounded-md [&_a]:text-[13px]">
            <SidebarLink item={nav.hub} to={nav.hub.to} />
          </div>

          {obraId && nav.obra.length > 0 && (
            <SidebarBlock title="Obra selecionada" subtitle="Acompanhamento" icon={Building} tone="obra">
              {nav.obra.map((item) => (
                <SidebarLink key={item.to} item={item} to={resolve(item.to)} />
              ))}
            </SidebarBlock>
          )}

          {nav.empresa.length > 0 && (
            <>
              {obraId && nav.obra.length > 0 && <div className="mx-3.5 my-2.5 border-t border-sidebar-border" />}
              <SidebarBlock title={EMPRESA.nome} subtitle={EMPRESA.sub} icon={EmpresaIcon} tone="empresa">
                {nav.empresa.map((item) => (
                  <SidebarLink key={item.to} item={item} to={resolve(item.to)} tone="empresa" />
                ))}
              </SidebarBlock>
            </>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-3">
          <p className="text-[15px] font-medium">Khaz Obras</p>
          <div className="flex items-center gap-2.5 text-[13px]">
            <span className="text-muted-foreground">{session?.name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut aria-hidden />
              Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-5">
          {obraId && (
            <Link
              to={nav.hub.to}
              className="mb-3 inline-flex items-center gap-1 text-[13px] text-info underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              {nav.hub.label}
            </Link>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};
