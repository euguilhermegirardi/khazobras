# KhazObras — Roadmap de execução

> Visão geral das fases. Cada fase tem (ou terá) seu próprio `PLAN-NN-*.md`
> com os passos detalhados.
> Referência funcional: `SPEC.md`

**Ritmo real disponível:** 30–60 min/dia. As fases foram dimensionadas para
serem executáveis em blocos pequenos, sem precisar de sessões longas.

---

## Status geral

| Fase | Nome | Status |
|---|---|---|
| 0 | Definição de escopo | ✅ Concluída |
| 1 | Fundação — ambiente e schema | ✅ Concluída |
| 2 | Autenticação e usuários | ✅ Concluída |
| 3 | Primeiro CRUD vertical (Obras) | ✅ Concluída |
| 4 | Storage de arquivos | ✅ Concluída |
| 5 | Domínio financeiro e medições | ✅ Concluída |
| 6 | Módulos client-facing | ✅ Concluída |
| 7 | Módulos de operação interna | ✅ Concluída |
| 8 | Notificações e auditoria | ✅ Concluída |
| — | **Reunião de revisão do backend** | 🔄 Próximo passo |
| 9 | Frontend React | ⬜ Não iniciada |
| 10 | PDF consolidado | ⬜ Não iniciada |
| 11 | Deploy no Render | ⬜ Não iniciada |

**Backend 100% implementado e testado, módulo por módulo, de ponta a ponta.**
Antes de avançar para o frontend, uma reunião de revisão vai conferir o que foi
construído contra o `SPEC.md`, seção por seção.

---

## Fase 0 — Definição de escopo ✅

Mapeamento do protótipo, definição das visões cliente e admin/master, escolha de
stack e padrões de arquitetura, modelagem do banco.

**Entregue:** `SPEC.md`

---

## Fase 1 — Fundação: ambiente e schema ✅

PostgreSQL 16 local (Homebrew), banco `khazobras_db` (UTF8), 6 scripts SQL
versionados aplicados (22 tabelas). Solução .NET 10 com as 4 camadas Clean
Architecture, referências entre projetos, pacotes NuGet, fábrica de conexão
Dapper/Npgsql, `/healthcheck`, middleware de erro global com `requestId`.
Repositório Git privado no GitHub, com README.

**Detalhes:** `PLAN-01-fundacao.md`

---

## Fase 2 — Autenticação e usuários ✅

Autenticação JWT construída à mão sobre Dapper (sem EF Core Identity):
`User` (Domain), `AuthService`/`UserService`, `PasswordHasherAdapter`,
`JwtTokenGenerator`, `UserRepository`. Endpoints `/auth/login`,
`/users` (`MasterOnly`), `/users/me`. Seed do primeiro usuário master.
Testado de ponta a ponta: login → JWT válido → acesso a rota protegida.

**Detalhes:** `PLAN-02-autenticacao.md`

---

## Fase 3 — Primeiro CRUD vertical (Obras) ✅

Fatia vertical completa (endpoint → validator → service → repository Dapper →
banco) usando Obras como molde. Paginação com o contrato
`{ totalItems, pageIndex, pageSize, items }`. Descoberta importante: colunas
com `CREATE TYPE ... AS ENUM` do Postgres exigem cast explícito (`@Status::obra_status`)
nos parâmetros do Dapper.

---

## Fase 4 — Storage de arquivos ✅

Cloudflare R2 (compatível com S3) escolhido no lugar de AWS S3 — mesmo custo
zero de egress, mesma API, migração futura para AWS seria só configuração.
`IStorageService`/`R2StorageService` com `AWSSDK.S3`. Contornada uma
incompatibilidade conhecida entre o SDK da AWS e o R2 (formato de assinatura
em streaming) via `RequestChecksumCalculation`/`ResponseChecksumValidation =
WHEN_REQUIRED` e `DisablePayloadSigning = true`. Upload/download testados
contra o bucket real.

---

## Fase 5 — Domínio financeiro e medições ✅

O núcleo do sistema. `Etapas` (CRUD simples, aninhado em `/obras/{obraId}/etapas`).
`Medições` com máquina de estados completa (`pending_approval` → `approved` →
`invoice_issued`), criação com itens numa única transação multi-tabela
(`IDbConnection` + `IDbTransaction`), transições ilegais bloqueadas com `409
Conflict`. `Financeiro` (lançamentos por categoria + anexos com upload/download
real via R2). Fluxo completo testado: criar medição → tentar pular etapa
(bloqueado) → aprovar → emitir NF.

---

## Fase 6 — Módulos client-facing ✅

`Relatório fotográfico` (fotos por mês/etapa, upload via R2). `Relatório
mensal` (conteúdo texto, transição `draft` → `published`, com filtro
`onlyPublished` já pensando na visão do cliente). `Projetos/Documentos
técnicos` (upload/download de plantas por etapa). Fluxo de publish testado de
ponta a ponta.

---

## Fase 7 — Módulos de operação interna ✅

Fornecedores, Prestadores (por obra), Estoque (itens + movimentações de
entrada/saída com recálculo automático de quantidade), Pipeline (CRM de
oportunidades). CRUDs simples, sem exposição ao cliente.

---

## Fase 8 — Notificações e auditoria ✅

`Notificações` com lista de módulos serializada em `JSONB` (via
`System.Text.Json`, ida e volta testada). Consulta restrita ao próprio usuário
(`/notificacoes/minhas`, via `ClaimsPrincipal`, sem expor `userId` na URL).
`LogAuditoria` como serviço reutilizável (`RegistrarAsync`) — estrutura pronta,
ainda não integrada retroativamente nas ações dos outros módulos (fica para
quando fizer sentido, ação por ação). Endpoint de consulta restrito a `MasterOnly`.

---

## Próximo passo — Reunião de revisão do backend 🔄

Antes de iniciar o frontend, conferir o backend inteiro contra o `SPEC.md`:

- [ ] Revisar visão CLIENTE (seção 5 do SPEC) — todos os dados necessários têm
      endpoint correspondente?
- [ ] Revisar visão ADMIN/MASTER (seção 6) — idem
- [ ] Conferir se os valores sensíveis (custo real interno, rentabilidade)
      estão de fato isolados dos endpoints que a visão cliente vai consumir
- [ ] Decidir sobre a integração retroativa do `LogAuditoria` nas ações
      sensíveis (aprovar medição, emitir NF, criar usuário, etc.) — fazer
      agora ou registrar como débito técnico para depois
- [ ] Confirmar que os 3 itens "fora do escopo do V1.0" (seção 10 do SPEC)
      continuam corretamente fora
- [ ] Levantar quaisquer endpoints faltantes antes de começar o frontend

---

## Fase 9 — Frontend React ⬜

Projeto Vite, roteamento com guarda por role, layout com navbar diferenciada
por perfil, telas — começando pelas do cliente (menor escopo, somente
leitura). A partir desta fase, o trabalho passa a ser feito com **Claude Code
no VS Code**, em vez deste fluxo de chat.

---

## Fase 10 — PDF consolidado ⬜

QuestPDF montando o documento final da obra por seções, reunindo dados de
múltiplos módulos.

---

## Fase 11 — Deploy no Render ⬜

Provisionar Postgres no Render, rodar os scripts de schema, configurar
variáveis de ambiente, publicar backend e frontend, apontar o domínio.

---

## Princípios de execução

1. **Vertical antes de horizontal.** Uma fatia completa de uma entidade
   (endpoint → banco) ensina mais e valida mais do que quatro camadas pela metade.
2. **Um módulo por vez, do mesmo jeito.** Depois da Fase 3, os módulos viraram
   repetição de um padrão conhecido — foi onde a velocidade apareceu.
3. **Spikes técnicos isolados.** Storage foi testado fora do domínio de
   negócio antes de ser integrado.
4. **Schema é estável, código é descartável.** Nenhuma mudança de schema foi
   necessária desde a Fase 1 — a modelagem inicial se sustentou.
5. **Commit pequeno e frequente.** Cada fase fechou com commit próprio,
   sincronizado com o GitHub.
