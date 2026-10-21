import type { ReactNode } from 'react';

interface PageSectionProps {
  title: string;
  /** Subtítulo cinza abaixo do título (protótipo: "Selecione um projeto para trabalhar..."). */
  description?: string;
  /** Ações à direita do título (ex.: botão primário). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Moldura padrão de uma tela: título (h1) + conteúdo. Usada também nos retornos de carregando/erro/vazio. */
export const PageSection = ({ title, description, actions, children }: PageSectionProps) => (
  <section aria-label={title}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="line-clamp-2 text-lg font-medium break-words" title={title}>
          {title}
        </h1>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);
