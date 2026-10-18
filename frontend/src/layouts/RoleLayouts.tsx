import { ADMIN_NAV, CLIENT_NAV } from './navigation'
import { AppShell } from './shell/AppShell'

// Itens da sidebar: layouts/navigation.ts (cada tela nova adiciona o seu, na ordem do SPEC §5/§6).
export const ClientLayout = () => <AppShell nav={CLIENT_NAV} obraRoute="/cliente/obras/:obraId/*" />
export const AdminLayout = () => <AppShell nav={ADMIN_NAV} obraRoute="/admin/obras/:obraId/*" />
