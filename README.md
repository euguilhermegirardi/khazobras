# KhazObras

Sistema de gerenciamento de obras para empresas de engenharia civil — cronograma,
medições com fluxo de aprovação do cliente, financeiro, relatórios fotográficos e
documentos técnicos, com visões separadas para administração da obra e para o
cliente final.

> Reconstrução completa (backend real, banco de dados, storage de arquivos) de um
> protótipo funcional em HTML/JS, feito em parceria com um engenheiro civil.
> 
> **Status:** Backend completo (fases 1–8 + review de segurança). Frontend em React + Vite será a próxima fase.

---

## Stack

**Backend**
- .NET 10 — ASP.NET Core (Minimal APIs)
- Clean Architecture (Api / Application / Domain / Infrastructure)
- Dapper + SQL puro (sem EF Core), Repository Pattern
- PostgreSQL 16
- ASP.NET Identity + JWT
- FluentValidation

**Frontend** *(ainda não iniciado)*
- React + Vite

**Infraestrutura**
- Storage de arquivos: AWS S3 ou Cloudflare R2
- Hospedagem: Render
- PDF: QuestPDF

Detalhes completos de arquitetura, convenções e decisões em [`docs/SPEC.md`](docs/SPEC.md) e [`CLAUDE.md`](CLAUDE.md).

---

## Decisões Arquiteturais

- **Dapper + SQL Puro** (sem EF Core): controle fino sobre queries complexas, melhor performance em relatórios, e clareza sobre o que está acontecendo no banco
- **Minimal APIs**: abordagem moderna e enxuta do ASP.NET Core, sem ceremony desnecessária
- **Clean Architecture**: separação clara entre Api, Application, Domain e Infrastructure, facilitando testes e manutenção
- **JWT + ASP.NET Identity**: autenticação stateless, escalável, com controle granular de permissões por role
- **Repository Pattern**: abstração de dados, facilitando testes e troca de banco de dados no futuro
- **Cloudflare R2** para storage: compatibilidade S3, menor custo que AWS, uptime SLA 99.9%

---

## Estrutura do repositório

```
khazobras/
├── backend/
│   ├── KhazObras.slnx
│   └── src/
│       ├── KhazObras.Api/              # Minimal APIs, Program.cs
│       ├── KhazObras.Application/      # Services, DTOs, Validators
│       ├── KhazObras.Domain/           # Entidades, enums, regras de domínio
│       └── KhazObras.Infrastructure/   # Repositories, Identity, Storage
├── database/
│   └── schema/                         # Scripts SQL versionados (001, 002, ...)
├── docs/
│   ├── SPEC.md                         # Especificação funcional completa (o quê)
│   ├── PLAN-00-roadmap.md              # Fases do projeto e status geral
│   └── PLAN-01-fundacao.md             # Plano detalhado da fase atual
└── frontend/                           # (a criar)
```

---

## Rodando localmente

**Pré-requisitos**
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- PostgreSQL 16 (`brew install postgresql@16` no macOS)

**1. Banco de dados**

```bash
brew services start postgresql@16
createdb khazobras_db
psql khazobras_db
```

Dentro do `psql`:
```sql
CREATE USER khazobras WITH PASSWORD 'khazobras123';
GRANT ALL PRIVILEGES ON DATABASE khazobras_db TO khazobras;
```

Aplique o schema, na ordem, a partir de `database/schema/`:
```bash
psql -d khazobras_db -f database/schema/001_create_users.sql
psql -d khazobras_db -f database/schema/002_create_obras.sql
psql -d khazobras_db -f database/schema/003_create_medicoes_financeiro.sql
psql -d khazobras_db -f database/schema/004_create_contratos_pagamentos.sql
psql -d khazobras_db -f database/schema/005_create_relatorios_documentos.sql
psql -d khazobras_db -f database/schema/006_create_operacao_sistema.sql
```

**2. Backend**

Crie `backend/src/KhazObras.Api/appsettings.Development.json` (não versionado):
```json
{
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Port=5432;Database=khazobras_db;Username=khazobras;Password=khazobras123"
  }
}
```

Rode:
```bash
cd backend
dotnet build
dotnet run --project src/KhazObras.Api
```

Teste com `curl http://localhost:5285/healthcheck` — deve responder
`{"status":"healthy","database":"connected"}`.

---

## Segurança

Implementado desde o início:
- ✅ Isolamento de dados por obra e por role (IDOR prevention)
- ✅ Validação de uploads (extensão, MIME type, magic bytes)
- ✅ Controle de acesso granular (Master / Admin / Client)
- ✅ JWT + refresh token strategy
- ✅ Audit logging para ações sensíveis
- ✅ Testes de segurança automatizados em `tests/KhazObras.Security.Tests`

Ver [`CLAUDE.md`](CLAUDE.md) para detalhes das regras de segurança.

## Status do projeto

Em desenvolvimento ativo. Acompanhamento das fases em
[`docs/PLAN-00-roadmap.md`](docs/PLAN-00-roadmap.md).

**Concluído:**
- ✅ Backend .NET 10 (fases 1–8)
- ✅ 22 tabelas PostgreSQL com schema versionado
- ✅ Repositórios + Services + Validators
- ✅ Upload/download de arquivos via R2
- ✅ Testes de segurança

**Próximo:**
- ⏳ Frontend React + Vite (visão cliente e admin)
