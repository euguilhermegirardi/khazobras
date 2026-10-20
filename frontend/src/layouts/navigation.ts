import {
  Building2,
  CalendarDays,
  Camera,
  ChartNoAxesGantt,
  FileSignature,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  Ruler,
  Wallet,
} from 'lucide-react';

/**
 * Itens da sidebar por visão. Ordem e nomes: SPEC §5 (cliente) e §6 (admin).
 * Cada tela nova adiciona o seu item aqui, na posição do SPEC (só telas que já existem).
 * Estrutura visual (blocos obra/empresa): docs/design/capturas/dashboard.png.
 */
export interface NavItem {
  label: string;
  /** Caminho; `:obraId` é trocado pela obra aberta. */
  to: string;
  icon: LucideIcon;
  /** Marca ativo só no caminho exato (para a "home" de um bloco). */
  end?: boolean;
}

export interface NavConfig {
  /** Item fixo do topo (Hub). */
  hub: NavItem;
  /** Bloco azul: telas da obra aberta (só aparece com uma obra aberta). */
  obra: NavItem[];
  /** Bloco verde: gestão da empresa (só admin/master). */
  empresa: NavItem[];
}

export const CLIENT_NAV: NavConfig = {
  hub: { label: 'Minhas obras', to: '/cliente', icon: LayoutGrid, end: true },
  obra: [
    { label: 'Dashboard', to: '/cliente/obras/:obraId', icon: LayoutDashboard, end: true },
    { label: 'Cronograma', to: '/cliente/obras/:obraId/cronograma', icon: CalendarDays },
    { label: 'Fechamento', to: '/cliente/obras/:obraId/fechamento', icon: Ruler },
    { label: 'Financeiro', to: '/cliente/obras/:obraId/financeiro', icon: Wallet },
    { label: 'Contratos', to: '/cliente/obras/:obraId/contratos', icon: FileSignature },
    { label: 'Relatório fotográfico', to: '/cliente/obras/:obraId/relatorio-fotografico', icon: Camera },
    { label: 'Relatório mensal', to: '/cliente/obras/:obraId/relatorio-mensal', icon: FileText },
    { label: 'Projetos', to: '/cliente/obras/:obraId/projetos', icon: FolderOpen },
  ],
  empresa: [],
};

export const ADMIN_NAV: NavConfig = {
  hub: { label: 'Meus projetos', to: '/admin', icon: LayoutGrid, end: true },
  obra: [
    { label: 'Dashboard', to: '/admin/obras/:obraId', icon: LayoutDashboard, end: true },
    { label: 'Gantt editável', to: '/admin/obras/:obraId/gantt', icon: ChartNoAxesGantt },
    { label: 'Medições', to: '/admin/obras/:obraId/medicoes', icon: Ruler },
    { label: 'Financeiro', to: '/admin/obras/:obraId/financeiro', icon: Wallet },
    { label: 'Contratos', to: '/admin/obras/:obraId/contratos', icon: FileSignature },
    { label: 'Relatório fotográfico', to: '/admin/obras/:obraId/relatorio-fotografico', icon: Camera },
  ],
  // Itens da empresa (Pipeline, Rentabilidade, Histórico, Administração) entram com as suas telas.
  empresa: [],
};

export const EMPRESA = { nome: 'Khaz Engenharia', sub: 'Gestão geral', icon: Building2 };
