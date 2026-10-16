import { Building2, LayoutDashboard, LayoutGrid, type LucideIcon, Ruler } from 'lucide-react'

/**
 * Itens da sidebar por visão. Ordem e nomes: SPEC §5 (cliente) e §6 (admin).
 * Cada tela nova adiciona o seu item aqui, na posição do SPEC (só telas que já existem).
 * Estrutura visual (blocos obra/empresa): docs/design/capturas/dashboard.png.
 */
export interface NavItem {
  label: string
  /** Caminho; `:obraId` é trocado pela obra aberta. */
  to: string
  icon: LucideIcon
  /** Marca ativo só no caminho exato (para a "home" de um bloco). */
  end?: boolean
}

export interface NavConfig {
  /** Item fixo do topo (Hub). */
  hub: NavItem
  /** Bloco azul: telas da obra aberta (só aparece com uma obra aberta). */
  obra: NavItem[]
  /** Bloco verde: gestão da empresa (só admin/master). */
  empresa: NavItem[]
}

export const CLIENT_NAV: NavConfig = {
  hub: { label: 'Minhas obras', to: '/cliente', icon: LayoutGrid, end: true },
  obra: [
    { label: 'Dashboard', to: '/cliente/obras/:obraId', icon: LayoutDashboard, end: true },
    { label: 'Fechamento', to: '/cliente/obras/:obraId/fechamento', icon: Ruler },
  ],
  empresa: [],
}

export const ADMIN_NAV: NavConfig = {
  hub: { label: 'Meus projetos', to: '/admin', icon: LayoutGrid, end: true },
  obra: [],
  empresa: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true }],
}

export const EMPRESA = { nome: 'Khaz Engenharia', sub: 'Gestão geral', icon: Building2 }
