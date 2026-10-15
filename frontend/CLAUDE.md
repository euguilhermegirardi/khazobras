# frontend/CLAUDE.md — KhazObras (React + Vite)

Complementa o `CLAUDE.md` da raiz (que vale para tudo, inclusive as regras de segurança).
Responda em português. Código, nomes de componentes e variáveis: inglês para infraestrutura
(`useAuth`, `apiClient`), português para o domínio (`Medicao`, `Etapa`, `Obra`), igual ao backend.

## Stack (decisões V1 — registrar mudanças no decision log)

- React 19 + Vite + TypeScript **strict** (`noUncheckedIndexedAccess` ligado)
- React Router 7 (rotas com guarda por role) — pacote `react-router-dom`
- TanStack Query (dados do servidor) — sem Redux; estado local com `useState`/`useReducer`
- React Hook Form + Zod (formulários)
- Tailwind CSS (puro por enquanto; shadcn/ui só se uma tela exigir componente complexo, e então registrar em `docs/PLAN-09-frontend.md`)
- Vitest + Testing Library + MSW (unit/integração); Playwright (e2e dos fluxos críticos)
- Gráficos (Dashboard/Curva S): Recharts, ainda não instalado — adicionar ao construir o Dashboard

## Estrutura

```
frontend/src/
  app/            # providers, router, layouts (ClientLayout, AdminLayout)
  features/<mod>/ # um diretório por módulo: api.ts, types.ts, hooks.ts, components/, pages/
  shared/         # ui/ (shadcn), lib/ (apiClient, formatters), hooks/
  test/           # setup, handlers MSW
```

Uma feature nunca importa de outra feature; o que for comum sobe para `shared/`.

## Contrato com a API

- Base URL vem de `import.meta.env.VITE_API_URL`. Nunca hardcode.
- `apiClient` único (`shared/lib/apiClient.ts`): injeta `Authorization: Bearer`, trata 401 (logout +
  redirect para login), 403 (tela "sem permissão"), 409 (transição inválida → mensagem ao usuário),
  500 (`{ requestId, message }` → mostrar o `requestId` para suporte).
- Listagens: `{ totalItems, pageIndex, pageSize, items }`, `pageIndex` base 0.
- Enums: **respostas** em PascalCase (`"PendingApproval"`), **requests** em snake_case
  (`"mao_de_obra"`). Manter dois mapas tipados por enum; nunca converter com string hacks espalhados.
- Dinheiro: `decimal` no backend. No front, formatar com `Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'})`.
  Nunca fazer aritmética de dinheiro com `number` para decidir regra de negócio — o backend calcula.
- Datas `DATE` chegam como `yyyy-MM-dd`: tratar como data local, **não** passar por `new Date(str)` sem
  cuidado (fuso de São Paulo vira dia anterior). Usar helper em `shared/lib/dates.ts`.
- Tipos da API ficam em `features/<mod>/types.ts`, espelhando os `sealed record` do backend. Ao mudar
  um DTO no backend, atualizar o tipo no mesmo PR.

## Segurança (inegociável — dados extremamente sensíveis)

1. **Esconder item de menu não é controle de acesso.** O backend decide; o front apenas reflete.
   Mesmo assim, rotas admin/master têm guarda por role e o cliente nunca monta componentes admin.
2. **Visão cliente nunca renderiza custo real/margem.** Se um endpoint devolver campo interno para
   o cliente, é bug do backend: reportar, não "esconder no JSX".
3. Token JWT (8h, sem refresh): guardado em `sessionStorage` (decisão V1; trade-off: XSS vs. recarregar
   a página). Nunca em `localStorage`, nunca em query string, nunca em log.
4. Sem `dangerouslySetInnerHTML`. Conteúdo vindo da API (relatórios, descrições) é sempre texto.
5. Downloads de anexos/projetos **pela API autenticada** (fetch com Bearer → blob → `URL.createObjectURL`),
   nunca link direto para o bucket.
6. Nenhum segredo em `.env` versionado. Só `VITE_API_URL` (público por natureza) em `.env.example`.
   Tudo com prefixo `VITE_` vai para o bundle — nunca colocar chave nele.
7. CORS: o front roda em origem fixa (`http://localhost:5173` em dev). O backend já libera **só** essa
   origem exata (política `Frontend`); em produção a origem vem de `Cors__AllowedOrigins__0`.
8. Cliente é somente leitura; única escrita: aprovar medição da própria obra. Nenhum botão de
   criar/editar/excluir na visão cliente.

## Qualidade

- Toda tela cobre os quatro estados: carregando, vazio, erro, sucesso.
- Acessibilidade: elementos semânticos, labels em todo input, foco visível, contraste AA.
- Linguagem da visão cliente é simplificada (sem SPI, CPI, Curva S).
- Teste por comportamento do usuário (Testing Library), não por implementação. Fluxo crítico =
  teste e2e: login, aprovar medição (cliente), criar medição (admin), acesso negado entre obras.
- Antes de concluir: `npm run lint && npm run typecheck && npm test` verdes.

## Padrões já estabelecidos (siga-os)

- **Feature de referência:** `src/features/obras/` (`types.ts` → `api.ts` → `hooks.ts` → `pages/`).
- Página reutilizável entre visões recebe o destino por prop (`ObraHubPage obraPath={...}`), em vez de
  duplicar a tela para cliente e admin.
- Erros de API: `ApiError` (`kind`, `requestId`); mostre `requestId` nos 500 e ofereça "Tentar novamente".
- Rotas novas entram em `src/app/AppRoutes.tsx` dentro da guarda do papel certo.
- Testes: ver `.claude/rules/frontend-testes.md`.
- Atualizou uma tela? Atualize `docs/PLAN-09-frontend.md` (tabela + registro).

## Git

Uma branch por tela (`feat/<tela>`); nunca commitar na `main`; nunca commitar `dist/`, `.env`,
`node_modules/`. Antes do commit: skill `checagem-pre-commit`.
O hook `.githooks/pre-commit` bloqueia commit de tela/rota/endpoint sem `docs/PLAN-09-frontend.md` junto
(ative com `bash scripts/instalar-hooks.sh`). Se bloquear, resolva sozinho, sem esperar o usuário: atualize
o plano, rode `npm run plano:registro -- --escrever`, `git add` e commite de novo. `SKIP_PLAN_CHECK=1` só
se o usuário pedir. Antes do merge: `plano:registro -- --escrever` com tudo commitado + commit `docs: registro`.

## Comandos (após o scaffold)

```bash
cd frontend
npm run dev        # http://localhost:5173
npm run build
npm run lint
npm run typecheck
npm test
npx playwright test   # quando existir
```

Requer Node 20.19+ (ou 22.12+). Primeira vez: `cp .env.example .env && npm install`.
Para logar de verdade a API precisa estar rodando (`cd backend && dotnet run --project src/KhazObras.Api`).
