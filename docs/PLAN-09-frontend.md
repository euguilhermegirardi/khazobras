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
- [x] Navbar do cliente: moldura sidebar + topbar em `src/app/shell/` (itens em `src/app/navigation.ts`).

## Telas do cliente (SPEC §5) — ordem sugerida

| # | Tela | Backend pronto? | Status | Branch / observação |
|---|---|---|---|---|
| 1 | Hub | ✅ `GET /obras` (cliente vê só as suas) | ✅ | `feat/hub-cliente` (na main) |
| 2 | Fechamento (medições + aprovar) | 🟨 endpoints ok; regra "só o cliente aprova" + UPDATE condicional em `feat/backend-aprovacao-cliente` (não compilado: validar no Mac) | 🟨 | `feat/fechamento`: lista + itens + aprovar com confirmação; 58 testes + 2 e2e; design e segurança do front ok. Vira ✅ quando o backend for validado e mesclado. Relatório: `docs/relatorios/2026-10-16-fechamento.md` |
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
- Medições (achados do `feat/fechamento`, para o `backend-gap-filler`): (1) `MedicaoResponse` devolve `ApprovedByUserId`
  (id interno) ao cliente — criar DTO reduzido para o cliente, como no Financeiro; o front já ignora o campo.
  (2) `POST /medicoes/{id}/approve` aceita qualquer papel com acesso à obra (Admin/Master também aprovam); SPEC §5/§8 diz
  que a aprovação é do cliente — decidir e cobrir em `Security.Tests`. (3) `GET /obras/{id}/medicoes` não é paginado
  (array puro) e não traz unidade, qtd. contratada, medido anterior nem saldo (colunas do protótipo); a tela mostra só
  descrição, tipo, quantidade, valor unitário e total.
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
- **Design = protótipo do engenheiro** (`docs/design/referencia.html`, anonimizado, + `capturas/`): tema copiado em
  `src/index.css` (claro/escuro pelo sistema, cores semânticas info/success/warning/danger/neutral), moldura
  sidebar+topbar em `src/app/shell/` (itens em `src/app/navigation.ts`), componentes `table`/`tabs`/`alert` +
  `KpiCard`/`ProgressBar`. Guia: `.claude/rules/frontend-design.md`. Do protótipo vem só a aparência; conteúdo é do SPEC.
- **Só desktop web** (SPEC §10): sem layout mobile; larguras de referência 1440px e 1280px. (O guia de design
  chegou a pedir 390px por engano; corrigido após a rodada supervisionada do Fechamento.)
- Verificação visual no loop: `design-reviewer` compara a captura da tela (`scripts/capturar-tela.mjs` + mocks do
  tester em `frontend/e2e/mocks/`) com a referência.
- Pendência de ambiente: o registro do shadcn (`ui.shadcn.com`) é bloqueado na sessão de nuvem; `table`/`tabs`/`alert`
  foram escritos a partir do código padrão do shadcn. Rodar agentes à noite na nuvem exige resolver isso
  (liberar o domínio ou rodar no Mac).
- Entrega de tela autônoma pela skill `ciclo-tela`: builder ↔ tester em loop (tester nunca corrige produção,
  builder nunca mexe nos testes do tester), máx. 3 rodadas, escala ao usuário em divergência/sem progresso.
- Interfaces/tipos da API em `src/shared/interfaces/`; componente só tem a interface das próprias props; um
  componente por arquivo; ordem fixa dentro do componente (`.claude/rules/frontend-componentes.md`).
- Componentes e funções internas como `const` + arrow; utilitários em `shared/lib` como `function` (lint cobra).
- Lint explícito em `frontend/.oxlintrc.json` (oxlint), com segurança (`no-danger`, sem `localStorage`), a11y e
  fronteiras de import (feature ↛ feature, shared ↛ features/app).
- Sessão/auth em `src/shared/auth/` (usada por várias telas); `features/auth/` só tem a tela de login.
- Node 20.19+ (ou 22.12+) por causa do Vite 8.
- Uma branch por tela (`feat/<tela>`); nunca commitar direto na `main`.
- Atualização do plano é travada no commit (hook versionado) e o Registro é gerado do git (`plano:registro`).
- Testes de rota passam pelo `renderApp` (helper) com MSW; endpoint não stubado derruba o teste.

- Fechamento (cliente): rota `/cliente/obras/:obraId/fechamento` (lista) e `.../fechamento/:medicaoId` (itens + aprovar).
  Aprovação pede confirmação inline (`Alert` + botões), porque o shadcn `alert-dialog` não pôde ser instalado na nuvem
  (pendência: trocar por `AlertDialog` quando o registro estiver acessível). Status em linguagem simples: "Aguardando sua
  aprovação" / "Aprovada" / "Nota fiscal emitida". Tipo `Medicao` omite `approvedByUserId` de propósito.

## Registro

- 2026-10-16 — `chore/design-somente-web`: Design check is desktop-only (SPEC §10): drop 390px requirement, use 1440/1280. Arquivos: infra (3), docs (1), front (1).
- 2026-10-16 — `feat/fechamento`: feat(fechamento): tela Fechamento do cliente (medições, itens e aprovação); test: fechamento (cliente) — unitários, e2e de aprovação e mock de captura. Arquivos: front (9), front/app (2), features/fechamento (10).
- 2026-10-16 — `chore/relatorio-manha`: Morning report: template with metrics, written by ciclo-tela on finish or stop. Arquivos: infra (1), outros (1), docs (1).
- 2026-10-16 — `chore/design-sistema`: Design reference: anonymize CREA and invoice numbers; Design system from the engineer's prototype: theme, app shell, base components, design guide, reference captures, design-reviewer in the loop. Arquivos: infra (8), outros (1), docs (18), front (15), front/app (5), features/obras (3).
- 2026-10-16 — `chore/design-referencia`: Design reference: anonymized prototype HTML in docs/design. Arquivos: outros (1), docs (2).
- 2026-10-16 — `chore/loop-agentes`: Loop builder↔tester: ciclo-tela skill, tester report contract, builder fix mode. Arquivos: infra (4), outros (1).
- 2026-10-15 — `chore/padroes-componentes`: Frontend conventions: explicit oxlint config, shared/interfaces, component structure rule. Arquivos: infra (2), outros (1), front (14), front/app (4), features/auth (1), features/obras (6).
- 2026-10-14 — `chore/skill-tela-shadcn`: Skill nova-tela-frontend: shadcn/ui guidance and Skeleton loading state. Arquivos: infra (1), front (2), features/obras (1).
- 2026-10-14 — `chore/revisao-infra`: Review of Claude infra: slim root CLAUDE.md, shadcn/ui setup, auth to shared/, gaps moved to PLAN-09. Arquivos: infra (2), outros (1), front (17), front/app (4), features/auth (1), features/obras (1).
- 2026-10-14 — `chore/registro-upsert`: Registro: one line per branch (upsert); agents resolve hook blocks on their own. Arquivos: infra (6), outros (1), front (1).
- 2026-10-14 — `chore/plano-automatico`: trava de commit (`.githooks/pre-commit`) exige este plano em mudanças de tela/rota/endpoint/schema; `npm run plano:registro` gera a linha do Registro a partir do git. Arquivos: infra (6), outros (1), front (2).
- 2026-10-14 — `feat/hub-cliente`: Hub do cliente (lista de obras, 4 estados), 27 testes. Navbar ainda
  não existe (layout só tem o cabeçalho).
- 2026-10-13 — Esqueleto: login, sessão, guardas de rota por papel, cliente de API, 22 testes.
