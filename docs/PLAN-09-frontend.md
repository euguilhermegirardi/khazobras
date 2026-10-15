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

- [ ] **Conversar com o Guilherme sobre biblioteca de componentes com Tailwind** (shadcn/ui ou outra) antes de
  seguir com as telas. Qualquer sessão (VS Code ou chat) deve lembrar disso antes de começar uma tela nova.

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

Ver "Lacunas do backend" no `CLAUDE.md` raiz. Ao implementar uma, remover de lá e marcar aqui.

## Decisões

- Token em `sessionStorage` (V1). Sem refresh; sessão expira em 8h.
- Estilo: Tailwind puro por enquanto; shadcn/ui e Recharts só quando uma tela exigir (Dashboard).
- Node 20.19+ (ou 22.12+) por causa do Vite 8.
- Uma branch por tela (`feat/<tela>`); nunca commitar direto na `main`.
- Atualização do plano é travada no commit (hook versionado) e o Registro é gerado do git (`plano:registro`).
- Testes de rota passam pelo `renderApp` (helper) com MSW; endpoint não stubado derruba o teste.

## Registro

- 2026-10-14 — `chore/registro-upsert`: Registro: one line per branch (upsert); agents resolve hook blocks on their own. Arquivos: infra (6), outros (1), front (1).
- 2026-10-14 — `chore/plano-automatico`: trava de commit (`.githooks/pre-commit`) exige este plano em mudanças de tela/rota/endpoint/schema; `npm run plano:registro` gera a linha do Registro a partir do git. Arquivos: infra (6), outros (1), front (2).
- 2026-10-14 — `feat/hub-cliente`: Hub do cliente (lista de obras, 4 estados), 27 testes. Navbar ainda
  não existe (layout só tem o cabeçalho).
- 2026-10-13 — Esqueleto: login, sessão, guardas de rota por papel, cliente de API, 22 testes.
