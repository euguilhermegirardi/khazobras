---
# Métricas (o maestro preenche; servem para medir se o harness está melhorando ao longo das noites)
data: 2026-10-20
tela: Contratos (cliente + admin)
branch: feat/contratos
resultado: entregue
pr: (ver PR da branch)
duracao_min: 90            # sessão supervisionada na nuvem (interrompida pelo limite de uso, retomada no dia seguinte)
rodadas_correcao: 0
falhas_tester: 0
falhas_design: 0
achados_seguranca: 2       # todas baixas
contestacoes: 0
motivo_parada: -
suite: verde
e2e: passou
---

# Relatório da manhã — Contratos (2026-10-20)

## Em uma linha
Contratos do cliente (somente leitura) e do admin (criar contrato, registrar pagamento) prontos, sem nenhuma rodada de correção. **Mesclar depois do #17 (Medições)**: a branch parte dela. O backend não foi compilado.

## Precisa de você
1. **Mesclar na ordem:** primeiro o PR #17 (Medições), depois o de Contratos (a branch contém os commits de Medições; o PR aponta para a `main`). Depois de cada merge, confira com `git log origin/main..origin/feat/<tela>` que nada ficou para trás.
2. **`dotnet build` e `dotnet test tests/KhazObras.Security.Tests` no Mac.** Sem script SQL novo (usa as tabelas do script 004). Pontos de maior risco de compilar errado: o `GROUP BY c.id` do `ContratoRepository` e as sobrecargas de `ToClienteView`.
3. **Teste manual com Postgres real:** criar contrato; repetir o número (409); registrar pagamento com e sem medição; tentar vincular medição sem NF (400); conferir que `dataPagamento` não recua um dia (o parâmetro passa por `@DataPagamento::date` dentro de um `INSERT ... SELECT`); conferir `totalPago` em `GET /obras/{id}/contratos`.
4. **Decisão de produto:** o KPI "Saldo a pagar" soma os saldos com sinal, então um contrato pago a mais abate o saldo de outro (no mock: -12.500,50 + 55.000,00 = 42.499,50). Quer assim, ou só a soma dos saldos positivos?
5. **Decisão de produto:** pagamento acima do valor contratado é permitido (adiantamentos e aditivos existem) e aparece como "Pago a mais". Confirme com o engenheiro.
6. **Financeiro do cliente:** as abas Resumo/Por categoria (contratado, pago, saldo) agora podem ser feitas a partir de `GET /obras/{id}/contratos`; não incluí nesta rodada.

## O que foi entregue
- **Cliente** (`/cliente/obras/:obraId/contratos`, item depois de Financeiro): KPIs (valor contratado total, total pago, saldo) só quando há 2+ contratos; um card por contrato (número, data de assinatura, valores, barra do pago) com a tabela de pagamentos (data, valor, forma, "Medição nº N" ou "—"). Saldo negativo vira "Pago a mais".
- **Admin** (`/admin/obras/:obraId/contratos`, item depois de Medições): lista com os mesmos números, "+ Novo contrato" e "Registrar pagamento" (medição vinculada opcional, só de medições com NF emitida).
- **Backend:** `POST /contratos`, `GET /obras/{id}/contratos` (DTO reduzido ao cliente, totais por SQL agregado, sem N+1), `GET /contratos/{id}` (com pagamentos), `POST /contratos/{id}/pagamentos`. Padrão obra_id → acesso → `WHERE ... AND obra_id`; medição do pagamento validada dentro do `INSERT ... SELECT` (mesma obra e `invoice_issued`); auditoria `contrato_criado` e `pagamento_registrado`.
- Capturas: `docs/relatorios/capturas/contratos/` e `contratos-admin/` (claro 1440, escuro e 1280).
- Suíte: 557 testes verdes; e2e 44/44 (12 novos).

## Como foi o loop
| Rodada | Quem achou | Falha (tipo) | Como foi corrigida |
|---|---|---|---|
| 0 | backend-gap-filler | (módulo novo, sem varredura de legado) | padrão de acesso desde o início |
| 0 | tester | nenhuma (VERDE, 76 testes + 12 e2e); observou o saldo com sinal | decisão no item 4 acima |
| 0 | design-reviewer | nenhuma (VERDE) | — |
| 0 | security-reviewer | 2 baixas: pagamento sem idempotência; testes HTTP não cobrem o SQL real | registradas no PLAN-09 |

## Decisões que os agentes tomaram sozinhos
- `storage_key` não é exposta a ninguém (sem upload de documento no V1).
- Data do pagamento aceita até hoje + 1 dia (backend em UTC; o front usa a data local, mais conservador).
- Detalhe dos pagamentos carregado em todos os cards de uma vez, sem expandir sob demanda.
- Select de medições do admin traz só as 100 mais novas com NF emitida; falha do select não bloqueia o pagamento.
- Sem editar/excluir contrato e pagamento (backlog: estorno/correção).
- Base compartilhada entre cliente e admin: `ContratoCard`, `ContratosKpis`, `PagamentosSecao`, `PagamentosTabela`, `utils/contrato.ts`.

## Sinais para o harness
- **Esta tela passou sem rodada de correção** depois do checklist 8f (tabelas largas) e do padrão de acesso no briefing do gap-filler: indício de que os ajustes de Medições funcionaram.
- **O limite de uso interrompeu o builder logo no início**; a retomada por mensagem funcionou, e os arquivos já estavam no disco.
- **Os testes HTTP usam repositório falso**, então o SQL de filtro por obra só é conferido por revisão manual. Candidato: um projeto de testes de integração com Postgres (item de backlog do harness).
- Dicas do tester para o futuro: com `server.use(a, b)` do MSW a primeira da lista tem prioridade; o shell tem o botão "Sair" (use `within(main)` ao procurar botões de escrita); o tsconfig do app não tem tipos do Node (use `vi.stubEnv('TZ')`); no e2e em dev o StrictMode repete GETs.
