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
| 1 | Fundação — ambiente e schema | 🔄 Em andamento |
| 2 | Autenticação e usuários | ⬜ Não iniciada |
| 3 | Primeiro CRUD vertical (Obras) | ⬜ Não iniciada |
| 4 | Storage de arquivos | ⬜ Não iniciada |
| 5 | Domínio financeiro e medições | ⬜ Não iniciada |
| 6 | Módulos client-facing | ⬜ Não iniciada |
| 7 | Módulos de operação interna | ⬜ Não iniciada |
| 8 | Notificações e auditoria | ⬜ Não iniciada |
| 9 | Frontend React | ⬜ Não iniciada |
| 10 | PDF consolidado | ⬜ Não iniciada |
| 11 | Deploy no Render | ⬜ Não iniciada |

---

## Fase 0 — Definição de escopo ✅

Mapeamento do protótipo, definição das visões cliente e admin/master, escolha de
stack e padrões de arquitetura, modelagem do banco.

**Entregue:** `SPEC.md`

---

## Fase 1 — Fundação: ambiente e schema 🔄

Deixar o ambiente local pronto e o banco com o schema completo aplicado.

**Concluído:**
- PostgreSQL 16 via Homebrew, banco `khazobras_db` (UTF8), role `khazobras`
- 6 scripts SQL versionados escritos e aplicados — 22 tabelas
- .NET 10 SDK instalado (10.0.401)
- Solução criada com as 4 camadas em `backend/src/`

**Falta:** referências entre projetos, pacotes NuGet, `appsettings`, conexão com
o banco, `/healthcheck`, `.gitignore`, repositório Git.

**Detalhes:** `PLAN-01-fundacao.md`

---

## Fase 2 — Autenticação e usuários

ASP.NET Identity sobre a tabela `users`, JWT, policies por role, e os endpoints
de gestão de usuários (criação restrita ao master).

Inclui o envio de e-mail com credenciais — pode ser stub no início (log no
console) e integrado com provedor real depois.

**Depende de:** Fase 1

---

## Fase 3 — Primeiro CRUD vertical (Obras)

Uma fatia completa atravessando todas as camadas: endpoint Minimal API →
validator → service → repository (Dapper) → banco. Inclui paginação, contratos de
resposta, tratamento de erro com `requestId` e os primeiros testes unitários.

**Por que Obras:** é a entidade mais simples que já exercita todos os padrões.
Serve de molde para todo o resto do sistema — a partir daqui, os demais módulos
viram repetição de um padrão já validado.

**Depende de:** Fase 2

---

## Fase 4 — Storage de arquivos

Decidir entre S3 e R2, criar o bucket, e implementar upload/download isolado
(`IStorageService` na Infrastructure). Testar fora do domínio de negócio antes de
plugar em qualquer módulo.

**Depende de:** Fase 1 (independente das fases 2 e 3 — pode ser feita em paralelo
se der vontade de variar)

---

## Fase 5 — Domínio financeiro e medições

O núcleo do sistema: etapas, medições com máquina de estados
(`pending_approval` → `approved` → `invoice_issued`), itens de medição,
lançamentos financeiros e anexos.

É onde entram as primeiras transações multi-tabela de verdade (aprovar medição
grava status + auditoria numa transação só).

**Depende de:** Fases 3 e 4

---

## Fase 6 — Módulos client-facing

Relatório fotográfico (mensal e por etapa), relatório mensal com fluxo
draft/published, e projetos/documentos técnicos por etapa.

**Depende de:** Fases 4 e 5

---

## Fase 7 — Módulos de operação interna

Fornecedores, prestadores, estoque (itens + movimentações) e pipeline.
Módulos mais simples, sem exposição ao cliente — bons para ganhar ritmo.

**Depende de:** Fase 3

---

## Fase 8 — Notificações e auditoria

Endpoint de "Notificar cliente" (checkbox de módulos → registro + disparo),
listagem de notificações para o topbar, e consolidação do `log_auditoria` em
todas as ações sensíveis.

**Depende de:** Fase 5

---

## Fase 9 — Frontend React

Projeto Vite, roteamento com guarda por role, layout com navbar diferenciada por
perfil, e as telas — começando pelas do cliente (menos telas, somente leitura,
escopo mais fechado).

**Depende de:** Fases 3+ (pode começar assim que houver endpoints reais para
consumir; não precisa esperar o backend inteiro)

---

## Fase 10 — PDF consolidado

QuestPDF montando o documento final da obra por seções, reunindo dados de
múltiplos módulos. Trabalho não-trivial — por isso fase própria, não um detalhe
de última hora.

**Depende de:** Fases 5 e 6

---

## Fase 11 — Deploy no Render

Provisionar Postgres no Render, rodar os scripts de schema, configurar variáveis
de ambiente, publicar backend e frontend, apontar o domínio.

**Depende de:** Fase 9

---

## Princípios de execução

1. **Vertical antes de horizontal.** Uma fatia completa de uma entidade
   (endpoint → banco) ensina mais e valida mais do que quatro camadas pela metade.
2. **Um módulo por vez, do mesmo jeito.** Depois da Fase 3, os módulos viram
   repetição de um padrão conhecido — é onde a velocidade aparece.
3. **Spikes técnicos isolados.** Storage e PDF são testados fora do domínio de
   negócio antes de serem integrados.
4. **Schema é estável, código é descartável.** Se um endpoint ficar ruim,
   reescreve. Mudança de schema com dados dentro custa muito mais caro.
5. **Commit pequeno e frequente.** Com 30–60 min/dia, terminar o dia com algo
   commitado importa mais do que terminar a funcionalidade.
