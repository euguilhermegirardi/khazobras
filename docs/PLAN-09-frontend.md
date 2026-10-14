# PLAN-09 — Frontend React (plano vivo)

> Documento de passagem entre sessões (VS Code, chat, subagentes). **Toda tela concluída atualiza
> este arquivo** (tabela + registro). Referências: `SPEC.md` §5/§6, `frontend/CLAUDE.md`.

## Como atualizar (obrigatório ao fechar uma tela)

1. Mudar o status da tela na tabela abaixo (⬜ → 🟨 em andamento → ✅ feita).
2. Acrescentar uma linha no **Registro** (data, branch, o que mudou, o que ficou pendente).
3. Se descobriu lacuna de backend, acrescentar na tabela de lacunas.
4. Se tomou decisão técnica, acrescentar em **Decisões**.

## Telas do cliente (SPEC §5) — ordem sugerida

| # | Tela | Backend pronto? | Status | Branch / observação |
|---|---|---|---|---|
| 1 | Hub | ✅ `GET /obras` (cliente vê só as suas) | ✅ | `feat/hub-cliente` (aguarda merge) |
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
- Testes de rota passam pelo `renderApp` (helper) com MSW; endpoint não stubado derruba o teste.

## Registro

- 2026-10-14 — `feat/hub-cliente`: Hub do cliente (lista de obras, 4 estados), 27 testes. Navbar ainda
  não existe (layout só tem o cabeçalho).
- 2026-10-13 — Esqueleto: login, sessão, guardas de rota por papel, cliente de API, 22 testes.
