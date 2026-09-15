# KhazObras — Especificação V1.0

> Documento de referência do **o quê**. Muda pouco.
> Para o **como** e a ordem de execução, ver os arquivos `PLAN-*.md`.

---

## 1. Contexto

Sistema de gerenciamento de obras para uma empresa de engenharia civil.

Origem: protótipo em HTML/JS puro com `localStorage`, criado com auxílio de IA
pelo engenheiro civil responsável. O V1.0 é uma reconstrução completa com backend
real, banco de dados e storage de arquivos — aproveitando o protótipo como
especificação funcional viva, não como base de código.

**Papéis:**
- Guilherme — desenvolvimento (full-stack)
- Engenheiro civil — dono do produto, define regras de negócio, usuário master

**Escala esperada:** ~3 obras simultâneas, ~4 logins ativos (1 master + clientes).
Escala pequena, sem requisitos de performance ou alta disponibilidade no V1.0.

---

## 2. Stack e infraestrutura

| Camada | Escolha |
|---|---|
| Backend | ASP.NET Core Web API, .NET 10, **Minimal APIs** |
| Arquitetura | Clean Architecture (Api / Application / Domain / Infrastructure) |
| Acesso a dados | **Dapper** + SQL puro (sem EF Core) |
| Padrão de dados | Repository Pattern, `IDbConnection` + `IDbTransaction` injetados |
| Banco | PostgreSQL 16 |
| Migrations | **Scripts SQL versionados** (`001_`, `002_`, ...), sem ferramenta de migration |
| Autenticação | ASP.NET Identity + JWT (apenas access token no V1.0) |
| Autorização | `Authorize` + Policies + Roles |
| Validação | FluentValidation |
| DTOs | Manuais, `sealed record`, sem AutoMapper |
| Serialização | `System.Text.Json` (nativo) |
| Testes | Unitários, priorizando Services e métodos de domínio |
| Frontend | React + Vite |
| Storage de arquivos | AWS S3 ou Cloudflare R2 (custo estimado: US$ 0–2/mês) |
| Hospedagem | Render (frontend, backend e Postgres) |
| E-mail | Serviço transacional (Resend/SendGrid) — criação de login |
| PDF | QuestPDF — relatório consolidado final da obra |
| Dev local | PostgreSQL via Homebrew, VS Code + C# Dev Kit |

**Domínio:** ainda não definido. Sugestão principal: `khazobras.com.br`.

---

## 3. Convenções e padrões de API

**Contratos de sucesso**
- Listagens paginadas: `{ totalItems, pageIndex, pageSize, items }`
- Criação: `201 Created`
- Atualização/exclusão sem retorno: `204 No Content`
- Atualização quando o frontend precisa do recurso atualizado: `200 OK` com corpo
  (ex.: aprovar medição e já devolver o novo status)

**Contrato de erro**
- `500` com corpo contendo `requestId` + mensagem orientando consultar os logs
  pelo `requestId`

**Outras convenções**
- `CancellationToken` onde adequado
- `sealed record` nos contratos de request/response, com tipos bem dimensionados
  (`decimal` para valores monetários — nunca `float`/`double`)
- Paralelismo com `Parallel.ForEach` / `Task.WhenAll` onde fizer sentido
- Logs com **message templates** (`LogInformation("Obra {ObraId} criada por {UserId}", ...)`)
- Rota de diagnóstico: `/healthcheck`
- Preferência por pacotes nativos da plataforma
- Documentar funcionalidades e suas dependências

**Idioma no código**
- Status de medição em **inglês** (`pending_approval`, `approved`, `invoice_issued`)
- Demais entidades e colunas em português (domínio da construção civil)

---

## 4. Perfis de acesso

| Role | Descrição |
|---|---|
| `master` | Perfil principal. **Único que cria novos admins e contas de cliente.** |
| `admin` | Acesso operacional completo, exceto criação de contas. |
| `client` | Somente leitura, restrito à própria obra. Única ação permitida: aprovar medição. |

**Regras:**
- Cliente vê exclusivamente a obra vinculada ao seu login
- Login de cliente pode ser compartilhado (ex.: casal) — 1 login por obra
- Contas são criadas pelo master; envio de credenciais por **e-mail** no V1.0
  (WhatsApp fica para depois)
- Não existe auto-cadastro

---

## 5. Visão CLIENTE (somente leitura)

Ordem do navbar:

1. **Hub** — seleção entre obras (raro ter mais de uma)
2. **Dashboard** — cards: Avanço físico, Prazo restante, Custo acumulado, Valor
   restante. Sections: "Avanço por etapa" e "Custo acumulado — todos os meses"
3. **Cronograma** — timeline. **Sem Curva S** (exclusiva do admin)
4. **Fechamento** — medição item a item (mão de obra, material) + **botão de
   aprovação**. Aprovação do cliente precede a emissão da NF
5. **Financeiro** — igual ao protótipo, porém somente leitura. Tab "Lançamentos"
   sem edição. Ícone de anexo por linha para baixar comprovantes
6. **Contratos** — absorve o item "Pagamentos"
7. **Relatório fotográfico mensal** — 2 tabs: **Mensal** e **Etapa**
8. **Relatório mensal** — versão publicada do "Relatório ao cliente", sem edição
9. **Projetos** — documentos técnicos/plantas por etapa; visualizar ou baixar PDF

**Regras da visão cliente:**
- Todo valor exibido é o **previsto/contratado**, nunca o custo real interno
  (protege a margem da empresa)
- Linguagem simplificada — termos técnicos (SPI, CPI, Curva S) ficam no admin
- Sem acesso a: Rentabilidade, Pipeline, Fornecedores, Estoque, Prestadores, KPIs
- Não existe item "Documentos" no navbar; comprovantes ficam no attach do Financeiro
- Notificações chegam pelo ícone no topbar (+ WhatsApp/e-mail quando o admin dispara)

---

## 6. Visão ADMIN / MASTER

Ordem do navbar (do uso mais frequente ao mais esporádico):

1. Hub
2. Dashboard — inclui **Comparativo entre obras**
3. Próximas ações *(página própria; era section do dashboard no protótipo)*
4. Cronograma — **com Curva S**
5. Gantt editável
6. RDO — diário de obra
7. Medições — criação, acompanhamento de status, emissão de NF
8. Financeiro — edição completa
9. Contratos (+ Pagamentos)
10. Rentabilidade — margem real, receita vs. custo *(nunca visível ao cliente)*
11. Relatório fotográfico mensal — upload das fotos
12. Projetos — upload de documentos técnicos
13. Relatório ao cliente — edição + histórico
14. Notificar cliente — checkbox de módulos atualizados
15. Fornecedores
16. Estoque
17. Prestadores
18. Pipeline — CRM de oportunidades
19. KPIs — SPI/CPI, qualidade
20. Gestão de usuários — **somente master**
21. Administração — dados da empresa, equipe, categorias, senha
22. Histórico/Log — auditoria

---

## 7. Funcionalidades novas (não existem no protótipo)

| Funcionalidade | Descrição |
|---|---|
| **Autenticação multiusuário** | Login com 3 roles, substituindo a senha única do protótipo |
| **Fechamento + aprovação** | Cliente aprova a medição; aprovação libera emissão da NF |
| **Relatório fotográfico mensal** | Registro visual do início ao fim, por mês e por etapa |
| **Projetos** | Documentos técnicos organizados por etapa |
| **Notificar cliente** | Admin marca módulos atualizados → WhatsApp/e-mail + modal no topbar |
| **Gestão de usuários** | Master cria admins e clientes, vincula cliente à obra |
| **PDF consolidado final** | Ao fim da obra, gera PDF único com todos os registros, por seção |
| **Storage real de arquivos** | Fotos, PDFs e comprovantes em S3/R2 |

---

## 8. Fluxo central: medição → aprovação → NF → pagamento

```
[admin] cria medição com itens (mão de obra, material, equipamento)
   ↓  status: pending_approval
[cliente] vê em "Fechamento", revisa item a item, aprova
   ↓  status: approved  (grava approved_at, approved_by_user_id)
[admin] emite a NF
   ↓  status: invoice_issued  (grava nf_number, nf_issued_at)
[admin] registra o pagamento recebido, opcionalmente vinculado à medição
```

Esse é o fluxo mais sensível do sistema — envolve dinheiro, aprovação formal e
documento fiscal. Toda mudança de status deve gerar registro em `log_auditoria`.

---

## 9. Modelo de dados (22 tabelas)

**Núcleo:** `users`, `obras`, `user_obra`, `etapas`

**Medições e financeiro:** `medicoes`, `medicao_itens`, `categorias`,
`financeiro_lancamentos`, `financeiro_lancamento_anexos`

**Contratos:** `contratos`, `pagamentos`

**Client-facing:** `relatorios_fotograficos`, `fotos`, `relatorios_mensais`,
`projetos_documentos`

**Operação interna:** `fornecedores`, `prestadores`, `estoque_itens`,
`estoque_movimentacoes`, `pipeline`

**Sistema:** `notificacoes`, `log_auditoria`

**Decisões de modelagem relevantes:**
- `user_obra` é N:N, apesar da regra atual ser 1 cliente = 1 obra — evita travar o
  schema se isso mudar
- Arquivos guardam apenas `storage_key` no banco; o binário vive no S3/R2
- `notificacoes.modulos` é `JSONB` (lista de módulos marcados no checkbox)
- `log_auditoria` usa `entidade` + `entidade_id` genéricos, em vez de uma tabela
  de log por módulo
- `pagamentos.referente_medicao_id` é opcional (permite adiantamentos e entradas)
- `fornecedores` é cadastro global; `prestadores` é por obra
- UUID como PK em todas as tabelas
- `NUMERIC(14,2)` para valores monetários

---

## 10. Fora do escopo do V1.0

- Acesso mobile (sistema é desktop-only por decisão)
- Atualização em tempo real (dado novo aparece no próximo acesso — sem websockets)
- WhatsApp Business API (avaliar depois; e-mail cobre o V1.0)
- Refresh token
- Permissões granulares por módulo (a única distinção master/admin é criação de contas)
- Comentários ou chat dentro do sistema (WhatsApp resolve, por decisão do cliente)
- Upload por parte do cliente (somente admin sobe arquivos)

---

## 11. Decisões pendentes

| Item | Status |
|---|---|
| Domínio da URL | Em aberto — `khazobras.com.br` é a sugestão principal |
| S3 vs. Cloudflare R2 | Em aberto — R2 evita custo de egress |
| Provedor de e-mail | Em aberto |
| WhatsApp para notificações | Adiado para pós-V1.0 |
| Transparência ao cliente | Engenheiro avaliando o quanto expor |
