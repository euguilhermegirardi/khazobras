import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SidebarBlockProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  /** Azul para a obra, verde para a empresa (borda à esquerda dos itens e avatar). */
  tone: 'obra' | 'empresa';
  children: ReactNode;
}

const TONE = {
  obra: { avatar: 'bg-info-soft text-info', border: 'border-info' },
  empresa: { avatar: 'bg-success-soft text-success', border: 'border-success' },
} as const;

/** Bloco da sidebar com cabeçalho (avatar + nome) e lista de itens (protótipo: .sidebar-block). */
export const SidebarBlock = ({ title, subtitle, icon: Icon, tone, children }: SidebarBlockProps) => (
  <div className="pr-1.5">
    <div className="flex items-center gap-2 px-3.5 py-2.5">
      <span className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-full', TONE[tone].avatar)}>
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs leading-tight font-medium text-foreground">{title}</p>
        {subtitle && <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    <div className={cn('ml-7 flex flex-col border-l-2', TONE[tone].border)}>{children}</div>
  </div>
);
