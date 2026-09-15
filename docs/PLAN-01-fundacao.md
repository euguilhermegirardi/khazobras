# PLAN 01 — Fundação: ambiente e schema

> **Objetivo da fase:** ambiente local funcionando, schema aplicado, solução .NET
> estruturada e rodando com conexão real ao banco.
> **Critério de conclusão:** `dotnet run` sobe a API e `GET /healthcheck` responde
> confirmando que o banco está acessível.

---

## ✅ Já concluído

- [x] PostgreSQL 16 instalado via Homebrew
- [x] Banco `khazobras_db` criado com encoding **UTF8**
- [x] Role `khazobras` criada com privilégios no banco
- [x] 6 scripts SQL versionados escritos e aplicados (22 tabelas):
  - `001_create_users.sql`
  - `002_create_obras.sql`
  - `003_create_medicoes_financeiro.sql`
  - `004_create_contratos_pagamentos.sql`
  - `005_create_relatorios_documentos.sql`
  - `006_create_operacao_sistema.sql`
- [x] .NET 10 SDK instalado (10.0.401)
- [x] VS Code + extensão C# Dev Kit
- [x] Solução criada com as 4 camadas em `backend/src/`

---

## 1.1 — Referências entre projetos

O fluxo de dependência da Clean Architecture:
`Api → Application → Domain`, com `Infrastructure` implementando as interfaces
definidas em `Application`. **`Domain` não referencia ninguém.**

Na pasta `backend/`:

```bash
dotnet add src/KhazObras.Application reference src/KhazObras.Domain
dotnet add src/KhazObras.Infrastructure reference src/KhazObras.Application
dotnet add src/KhazObras.Api reference src/KhazObras.Application
dotnet add src/KhazObras.Api reference src/KhazObras.Infrastructure
```

> A `Api` referencia `Infrastructure` apenas para registrar as implementações
> no contêiner de injeção de dependência no `Program.cs`. Os endpoints
> conversam com `Application`, nunca com `Infrastructure` diretamente.

**Validar:** `dotnet build` compila sem erro.

---

## 1.2 — Pacotes NuGet

```bash
# Infrastructure — acesso a dados
dotnet add src/KhazObras.Infrastructure package Dapper
dotnet add src/KhazObras.Infrastructure package Npgsql

# Application — validação
dotnet add src/KhazObras.Application package FluentValidation
dotnet add src/KhazObras.Application package FluentValidation.DependencyInjectionExtensions

# Api — autenticação (usados na Fase 2, mas já ficam instalados)
dotnet add src/KhazObras.Api package Microsoft.AspNetCore.Authentication.JwtBearer
```

**Validar:** `dotnet build` continua compilando.

---

## 1.3 — Configuração e secrets

Em `src/KhazObras.Api/appsettings.Development.json`, a connection string local:

```json
{
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Port=5432;Database=khazobras_db;Username=khazobras;Password=khazobras123"
  }
}
```

**Importante:** essa senha só vale para desenvolvimento local. Em produção
(Render), a connection string vem de **variável de ambiente**, nunca de arquivo
versionado. Para segredos locais mais sensíveis, usar `dotnet user-secrets`.

---

## 1.4 — Git e `.gitignore`

Na raiz do repositório, antes do primeiro commit:

```bash
dotnet new gitignore
git init
git add .
git commit -m "chore: estrutura inicial do backend e schema do banco"
```

**Conferir antes de commitar:** `bin/`, `obj/` e `appsettings.Development.json`
não devem entrar no repositório.

**Mover os scripts SQL** para `backend/database/schema/` (se ainda não estiverem
lá) — eles fazem parte do projeto e devem ser versionados junto.

---

## 1.5 — Conexão com o banco (Infrastructure)

Criar uma fábrica de conexões que entrega `IDbConnection` para os repositories,
seguindo o padrão definido (`IDbConnection` + `IDbTransaction` injetados, sem
Unit of Work por cima).

Estrutura sugerida:

```
src/KhazObras.Infrastructure/
└── Persistence/
    ├── IDbConnectionFactory.cs
    └── NpgsqlConnectionFactory.cs
```

A fábrica lê a connection string da configuração e devolve uma `NpgsqlConnection`
aberta. Registrar no DI do `Program.cs`.

---

## 1.6 — Healthcheck

Endpoint `/healthcheck` que confirma que a API está viva **e** que o banco
responde (um `SELECT 1` via Dapper já basta).

Retorna `200` quando tudo ok; `500` no contrato de erro padrão quando o banco
não responde.

> Esse endpoint não é enfeite: é o que vai dizer, no deploy do Render, se o
> problema está na aplicação ou na conexão com o banco.

---

## 1.7 — Middleware de erro

Middleware global que captura exceções não tratadas e devolve o contrato
definido no `SPEC.md`:

```json
{
  "requestId": "<guid>",
  "message": "Erro inesperado. Consulte os logs com o requestId informado."
}
```

O mesmo `requestId` deve ir para o log, com message template, para permitir a
busca depois.

---

## Checklist de conclusão da fase

- [ ] Referências entre projetos configuradas, `dotnet build` limpo
- [ ] Pacotes NuGet instalados
- [ ] `appsettings.Development.json` com a connection string local
- [ ] `.gitignore` correto e primeiro commit feito
- [ ] Scripts SQL versionados em `backend/database/schema/`
- [ ] Fábrica de conexão implementada e registrada no DI
- [ ] `/healthcheck` respondendo e confirmando acesso ao banco
- [ ] Middleware de erro devolvendo o contrato com `requestId`

**Quando tudo acima estiver marcado → Fase 2 (Autenticação e usuários).**
