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
| — | Reunião de revisão do backend (SPEC) | ✅ Concluída |
| — | Revisão de segurança (interna + auditoria externa) | ✅ Concluída |
| 9 | Frontend React | ⬜ Próximo passo |
| 10 | PDF consolidado | ⬜ Não iniciada |
| 11 | Deploy no Render | ⬜ Não iniciada |

**Backend oficialmente entregue.** 100% implementado, testado módulo por
módulo de ponta a ponta, revisado contra o `SPEC.md`, e auditado em duas
rodadas de segurança (interna e externa). A partir daqui, o trabalho migra
para **Claude Code no VS Code**.

---

## Revisão de segurança — resumo final

**Corrigido:**
- Isolamento de dados por obra (`user_obra` nunca era checado em código —
  qualquer client autenticado lia qualquer obra e todos os módulos internos)
- IDOR em `POST /notificacoes/{id}/marcar-lida` (sem checagem de dono,
  achado pela auditoria externa)
- `UploadFinanceiroAnexo` sem checagem de acesso por obra
- `POST /users` sem cast `::user_role` (nunca tinha sido testado de verdade)
- `/healthcheck` vazando detalhe de exceção para chamador anônimo
- Validação de upload nos 3 endpoints: tamanho, allow-list de extensão, extensão
  compatível com o MIME e assinatura do arquivo (magic bytes de JPEG, PNG, GIF,
  WebP, PDF, OOXML e OLE2)
- `marcar-lida` com `AND user_id` no `UPDATE` (defesa em profundidade) e `404`
  para ID inexistente
- Projeto de testes `KhazObras.Security.Tests` (xUnit) com 5 testes de regressão
  (IDOR em notificações e validação de upload)
- Validação de formato de e-mail e complexidade de senha em `CreateUserRequest`
- `database/seed/001_seed_master.sql` (hash de senha real) removido do
  versionamento e adicionado ao `.gitignore`
- `GET /users` (listagem, `MasterOnly`) adicionado

**Descartado (falso positivo, confirmado com evidência):**
- "appsettings.Development.json exposto no repositório" — confirmado via
  `git log`/`git ls-files` que nunca foi commitado; o `.gitignore` da Fase 1
  funcionou corretamente desde o início

**Pendências conscientes, aceitas para o V1:**
- Sem rate limiting em `/auth/login`
- JWT sem revogação/refresh (expira em 8h — trade-off já previsto no `SPEC.md`)
- `DownloadFinanceiroAnexo` e `DownloadProjetoDocumento` ainda restritos a
  `AdminOrMaster` (stopgap — os services ainda não expõem `ObraId` para
  liberar o cliente dono)
- Validação de upload confere a assinatura do arquivo, não o conteúdo inteiro:
  `.txt` não tem checagem de conteúdo e um ZIP qualquer renomeado para
  `.docx`/`.xlsx` passa
- Histórico do Git ainda contém o seed removido (repo privado, risco aceito)

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
`/users` (`MasterOnly`), `/users/me`, `GET /users`. Seed do primeiro usuário
master (removido do versionamento após a revisão de segurança). Testado de
ponta a ponta: login → JWT válido → acesso a rota protegida.

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
oportunidades). CRUDs simples, restritos a Admin/Master, sem exposição ao
cliente.

---

## Fase 8 — Notificações e auditoria ✅

`Notificações` com lista de módulos serializada em `JSONB` (via
`System.Text.Json`, ida e volta testada). Consulta e marcação de leitura
restritas ao próprio usuário (corrigido IDOR na revisão de segurança).
`LogAuditoria` como serviço reutilizável (`RegistrarAsync`) — estrutura
pronta, ainda não integrada retroativamente nas ações dos outros módulos.
Endpoint de consulta restrito a `MasterOnly`.

---

## Fase 9 — Frontend React ⬜ (próximo passo)

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

## Decisão em aberto — produto/SaaS

Guilherme está considerando transformar o sistema num SaaS vendável, não só
um projeto sob medida para a Khaz Engenharia. Pontos levantados que precisam
de decisão antes de ir nessa direção:

- **Multi-tenancy:** o sistema hoje é single-tenant (Fornecedores, Pipeline e
  Categorias são globais, não por empresa) — adicionar isolamento por empresa
  agora, antes de dados reais de múltiplos clientes, é bem mais barato que
  depois
- **Nome do produto:** "KhazObras" vem do nome da empresa do amigo (Khaz
  Engenharia) — precisa de um nome neutro antes de qualquer venda a
  terceiros. Renomear agora (namespaces, banco, bucket, repositório) é
  mecânico; depois de clientes reais, é caro
- **Validação de mercado:** concorrentes estabelecidos existem (Sienge,
  Obra Prima, UAU); vale conversar com outros engenheiros/pequenas
  construtoras antes de investir em cobrança e landing page
- **Alinhamento com o amigo:** quem é dono do quê, se a Khaz Engenharia seria
  o cliente zero, divisão de receita — conversar antes de avançar

Decisão: continuar com o escopo atual (projeto para a Khaz Engenharia) por
ora; revisitar a ideia de SaaS depois do frontend.

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
6. **Segurança revisada em camadas.** Revisão própria contra o SPEC, depois
   auditoria externa independente — a segunda camada pegou algo que a
   primeira não viu (IDOR em notificações), confirmando o valor de olhos
   diferentes sobre o mesmo código.
