# PLAN-09 — Frontend React (plano vivo)

> Documento de passagem entre sessões (VS Code, chat, subagentes). **Toda tela concluída atualiza
> este arquivo** (tabela + registro). Referências: `SPEC.md` §5/§6, `frontend/CLAUDE.md`.

## Como atualizar (obrigatório ao fechar uma tela)

> O hook `.githooks/pre-commit` bloqueia o commit de tela/rota/endpoint/script de banco sem este arquivo
> staged. Ativar: `bash scripts/instalar-hooks.sh`. O agente atualiza; você só revisa o diff.

1. Mudar o status da tela na tabela abaixo (⬜ → 🟨 em andamento → ✅ feita).
2. Acrescentar uma linha no **Registro**: `cd frontend && npm run plano:registro -- --escrever` gera a linha
   a partir do git; complete com "Pendente: ..." se houver. É **uma linha por branch**: rodar de novo
   substitui a anterior e preserva o "Pendente:". Antes do merge, rode de novo com tudo commitado
   (commit `docs: registro`).
5. Hook bloqueou? O agente resolve sozinho (itens 1–4 + `git add` + commit), sem esperar o usuário.
3. Se descobriu lacuna de backend, acrescentar na tabela de lacunas.
4. Se tomou decisão técnica, acrescentar em **Decisões**.

## Pendências antes da próxima tela

- [x] Biblioteca de componentes decidida: **shadcn/ui** (ver Decisões).
- [ ] Navbar do cliente (layout ainda só tem cabeçalho) — fazer antes ou junto da tela Fechamento.

## Telas do cliente (SPEC §5) — ordem sugerida

| # | Tela | Backend pronto? | Status | Branch / observação |
|---|---|---|---|---|
| 1 | Hub | ✅ `GET /obras` (cliente vê só as suas) | ✅ | `feat/hub-cliente` (na main) |
| 2 | Fechamento (medições + aprovar) | ✅ `GET /obras/{id}/medicoes`, `POST /medicoes/{id}/approve` | ⬜ | fluxo crítico; teste de papel obrigatório |
| 3 | Relatório mensal | ✅ `GET /obras/{id}/relatorios-mensais?onlyPublished=true` | ⬜ | |
| 4 | Relatório fotográfico | ✅ `GET /obras/{id}/relatorios-fotograficos` | ⬜ | |
| 5 | Financeiro (somente leitura) | ✅ lançamentos `visivel_cliente` + download de comprovante | ⬜ | parcelas dependem de Contratos |
| 6 | Cronograma (sem Curva S) | 🟨 `GET /obras/{id}/etapas`; falta % concluído | ⬜ | lacuna: atualização de etapas |
| 7 | Projetos | 🟨 listagem ok; download pelo cliente bloqueado | ⬜ | lacuna: liberar download ao cliente da obra |
| 8 | Contratos | ❌ sem endpoints | ⬜ | lacuna: módulo Contratos/Pagamentos |
| 9 | Dashboard | ❌ sem KPIs/custo acumulado | ⬜ | lacuna: Dashboard/KPIs |

Navbar do cliente cresce uma entrada por tela entregue (ordem do SPEC §5).

## Telas admin/master (SPEC §6)

Começam depois da visão cliente. Prioridade provável: Medições (criar e emitir NF), Financeiro (edição
e flag `visivel_cliente`), Relatórios. Detalhar aqui quando iniciar.

## Lacunas de backend que bloqueiam telas

Ao implementar uma, removê-la daqui e atualizar a tabela de telas. Faltam (provavelmente com script `008_*.sql`+):

- Contratos e pagamentos (endpoints) — bloqueia Contratos e parcelas do Financeiro do cliente
- Dashboard / KPIs / Curva S / Rentabilidade / comparativo entre obras — bloqueia Dashboard
- Cronograma: atualização de etapas e campo de % concluído — bloqueia Cronograma completo
- Download de anexos de **projetos** pelo cliente da obra (hoje só AdminOrMaster) — bloqueia Projetos
- Categorias (CRUD); Empresa / equipe (Administração) — telas admin
- PUT/PATCH/DELETE na maioria dos módulos; `GET /users/{id}`, desativar usuário — telas admin
- Envio real de e-mail / WhatsApp nas notificações
- Integração do `LogAuditoria` nas ações dos demais módulos (estrutura pronta, não plugada)
- PDF consolidado (Fase 10)

## Decisões

- Token em `sessionStorage` (V1). Sem refresh; sessão expira em 8h.
- Componentes: **shadcn/ui** (Tailwind 4, tema por variáveis CSS em `src/index.css`), código em `src/shared/ui/`.
  Button, Card, Badge e Skeleton já instalados; Hub e Login usam. Recharts entra com o Dashboard.
- Estado: TanStack Query (servidor) + `useState`/`useReducer` (local) + Context só para a sessão. Sem Zustand.
- E2E: Playwright (WebKit/Safari, paralelismo grátis); instalar no primeiro fluxo crítico (aprovar medição).
- Sessão/auth em `src/shared/auth/` (usada por várias telas); `features/auth/` só tem a tela de login.
- Node 20.19+ (ou 22.12+) por causa do Vite 8.
- Uma branch por tela (`feat/<tela>`); nunca commitar direto na `main`.
- Atualização do plano é travada no commit (hook versionado) e o Registro é gerado do git (`plano:registro`).
- Testes de rota passam pelo `renderApp` (helper) com MSW; endpoint não stubado derruba o teste.

## Registro

- 2026-10-14 — `chore/revisao-infra`: Review of Claude infra: slim root CLAUDE.md, shadcn/ui setup, auth to shared/, gaps moved to PLAN-09. Arquivos: infra (2), outros (1), front (17), front/app (4), features/auth (1), features/obras (1).
- 2026-10-14 — `chore/registro-upsert`: Registro: one line per branch (upsert); agents resolve hook blocks on their own. Arquivos: infra (6), outros (1), front (1).
- 2026-10-14 — `chore/plano-automatico`: trava de commit (`.githooks/pre-commit`) exige este plano em mudanças de tela/rota/endpoint/schema; `npm run plano:registro` gera a linha do Registro a partir do git. Arquivos: infra (6), outros (1), front (2).
- 2026-10-14 — `feat/hub-cliente`: Hub do cliente (lista de obras, 4 estados), 27 testes. Navbar ainda
  não existe (layout só tem o cabeçalho).
- 2026-10-13 — Esqueleto: login, sessão, guardas de rota por papel, cliente de API, 22 testes.
