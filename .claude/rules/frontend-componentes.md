---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.ts"
---

# Componentes e arquivos do frontend

Exemplo completo: `src/features/obras/pages/ObraHubPage.tsx` e `components/ObraCard.tsx`.

## Onde fica cada coisa

- **Interfaces/tipos de API e domínio:** `src/shared/interfaces/<dominio>.ts` (`obra.ts`, `auth.ts`, `paged.ts`).
  Espelham os `sealed record` do backend; mudou o DTO, muda aqui no mesmo PR.
- **No arquivo do componente:** só a interface das props dele (`interface ObraCardProps`). Nada de outros tipos.
- **Um componente por arquivo.** Peças só da feature: `features/<mod>/components/`; reutilizáveis entre telas:
  `src/shared/components/` (ex.: `ErrorState`, `PageSection`); base do shadcn: `src/shared/ui/`.
- **Constantes da feature** (mapas de rótulo etc.): `features/<mod>/constants.ts`.
- **Funções utilitárias puras:** `src/shared/lib/*.ts`, declaradas com `function` (o lint cobra).

## Ordem dentro do componente

```tsx
interface XxxProps { ... }                 // 1. props (única interface do arquivo)

const LIMITE = 10                          // 2. constantes que não dependem de props/estado: FORA do componente

export const Xxx = ({ ... }: XxxProps) => {   // componente sempre const + arrow (o lint cobra)
  // Estados
  const [aberto, setAberto] = useState(false)
  // Hooks (TanStack Query, useAuth, useNavigate...)
  const { data, isPending, isError, error, refetch } = useAlgo()
  // Constants derivadas (dependem de props/estado)
  const total = data?.items.length ?? 0
  // Functions: sempre const + arrow
  const handleRetry = () => void refetch()
  // Effects (raros: dado do servidor é TanStack Query, nunca useEffect)
  useEffect(() => { ... }, [dep])
  // Retornos breves: carregando / erro / vazio — SEMPRE depois de todos os hooks
  if (isPending) return <PageSection title="...">...</PageSection>
  if (isError) return <PageSection title="..."><ErrorState ... /></PageSection>
  // Return
  return <PageSection title="...">...</PageSection>
}
```

- Hooks importados pelo nome: `import { useEffect, useState } from 'react'` (nunca `React.useEffect`).
- Nenhum hook depois de um `return` antecipado (regra do React; o lint `rules-of-hooks` cobra).
- `const` com arrow vs `function`: dentro de componentes, arrow (não sofre hoisting, força leitura de cima
  para baixo); em `shared/lib`, `function` nomeada.

## O que o lint cobra sozinho (`frontend/.oxlintrc.json`)

`rules-of-hooks`, `exhaustive-deps`, `no-danger` (sem `dangerouslySetInnerHTML`), `localStorage` proibido,
`no-explicit-any`, `import type`, `===`, sem `console`, `alt` e `label` obrigatórios, `func-style` (arrow em
componentes, `function` em `shared/lib`), feature não importa de outra feature, `shared/` não importa de
`features/`/`app/`. A **ordem** das seções acima o lint não cobra: siga o exemplo.
