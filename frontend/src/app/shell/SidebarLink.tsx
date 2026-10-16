import { NavLink } from 'react-router-dom'
import type { NavItem } from '../navigation'
import { cn } from '@/shared/lib/utils'

interface SidebarLinkProps {
  item: NavItem
  /** Caminho final (com `:obraId` já resolvido). */
  to: string
  /** Cor do item ativo: azul (obra/hub) ou verde (empresa), como no protótipo. */
  tone?: 'obra' | 'empresa'
}

const ACTIVE_CLASS = {
  obra: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
  empresa: 'bg-success/10 font-medium text-success',
} as const

/** Item de navegação da sidebar (protótipo: .nav-item). */
export const SidebarLink = ({ item, to, tone = 'obra' }: SidebarLinkProps) => {
  const Icon = item.icon

  return (
    <NavLink
      to={to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-r-md px-2.5 py-1.5 text-[12.5px] text-sidebar-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
          isActive && ACTIVE_CLASS[tone],
        )
      }
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {item.label}
    </NavLink>
  )
}
