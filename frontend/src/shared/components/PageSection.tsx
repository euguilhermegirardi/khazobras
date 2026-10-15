import type { ReactNode } from 'react'

interface PageSectionProps {
  title: string
  children: ReactNode
}

/** Moldura padrão de uma tela: título (h1) + conteúdo. Usada também nos retornos de carregando/erro/vazio. */
export const PageSection = ({ title, children }: PageSectionProps) => (
  <section aria-label={title}>
    <h1 className="text-xl font-semibold">{title}</h1>
    <div className="mt-4">{children}</div>
  </section>
)
