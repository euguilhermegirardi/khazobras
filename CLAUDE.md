# CLAUDE.md — KhazObras

Sistema de gerenciamento de obras (Khaz Engenharia). Backend .NET 10 + Postgres + Cloudflare R2 pronto para uso; frontend React ainda não iniciado.
O usuário (Guilherme) responde em português — responda em português.

Referências obrigatórias antes de mexer em algo grande:
- `docs/SPEC.md` — o quê (funcionalidades, perfis, modelo de dados)
- `docs/PLAN-00-roadmap.md` — fases e status

## Estado atual

- Backend fases 1–8 concluídas, revisão de segurança concluída, 47 testes passando (`KhazObras.Security.Tests`).
- **Backend NÃO cobre todo o SPEC** — ver "Lacunas do backend" abaixo.
- Próxima fase: 9 (frontend React + Vite), começando pela visão do cliente.

## Agentes e skills do projeto (`.claude/`)

Subagentes (`.claude/agents/`):
- `backend-gap-filler` — implementa lacuna do backend (endpoint, módulo, script 007+) com teste.
- `frontend-builder` — constrói uma tela por vez a partir do SPEC; para se faltar endpoint.
- `frontend-tester` — testes Vitest/MSW/Playwright em contexto separado de quem escreveu o código.
- `security-reviewer` — revisão somente-leitura (acesso, IDOR, vazamento de custo ao cliente, segredos).

Skills (`.claude/skills/`): `novo-endpoint-backend`, `nova-tela-frontend`, `checagem-pre-commit`.

Fluxo por tela: lacuna? → `backend-gap-filler` → `frontend-builder` → `frontend-tester` →
`security-reviewer` (telas com escrita/restrição) → `checagem-pre-commit` → commit.
Regras do frontend: `frontend/CLAUDE.md`.

## Estrutura

```
backend/
  KhazObras.slnx
  src/KhazObras.Api            # Program.cs (todos os endpoints), Validation/
  src/KhazObras.Application    # Services, DTOs, Validators, Abstractions
  src/KhazObras.Domain         # Entidades, enums
  src/KhazObras.Infrastructure # Repositories (Dapper), Storage (R2), Persistence
  tests/KhazObras.Security.Tests
database/schema/001..007_*.sql # scripts versionados (007 = visivel_cliente no financeiro)
docs/                          # SPEC, PLAN-*
frontend/                      # a criar
```

## Comandos

```bash
cd backend
dotnet build
dotnet test tests/KhazObras.Security.Tests
dotnet run --project src/KhazObras.Api     # http://localhost:5285
curl http://localhost:5285/healthcheck
psql -d khazobras_db
```

Postgres local via Homebrew: `brew services start postgresql@16`.

## Regras por área (`.claude/rules/`)

Carregadas só ao mexer nos caminhos indicados:
- `backend-convencoes.md` (`backend/**`) — convenções de API/código e armadilhas já pagas.
- `banco-de-dados.md` (`database/**` e Infrastructure) — schema, enums, SQL.
- Frontend: `frontend/CLAUDE.md` (carrega ao trabalhar em `frontend/`).

## Regras de segurança (inegociáveis — dados extremamente sensíveis)

1. **Nenhum segredo em arquivo versionado.** Segredos só em `appsettings.Development.json` (gitignored) ou variáveis de ambiente. `appsettings.json` contém apenas Logging + AllowedHosts.
2. **Antes de todo commit**: `git diff --cached` e um grep por segredos (chaves R2, JWT secret, senhas, hashes). Se achar algo, parar.
3. Sem seed com hash de senha no repositório. O primeiro master é criado fora do git.
4. Endpoint com escopo de obra → sempre `ObraAccessService.EnsureAccessAsync`; `UnauthorizedAccessException` → `Results.Forbid()`.
5. Módulos internos (fornecedores, prestadores, estoque, pipeline) → `RequireAuthorization("AdminOrMaster")`. Criação de usuários e log de auditoria → `MasterOnly`.
6. Cliente é somente leitura; única escrita permitida: aprovar medição da própria obra.
7. Todo upload passa por `FileUploadValidator` (10 MB, extensão + MIME + magic bytes). Downloads sempre pela API autenticada, nunca URL pública do bucket.
8. Filtrar também por dono no SQL (defense in depth), ex.: `WHERE id = @Id AND user_id = @UserId`.
9. CORS ainda não configurado: ao ligar o frontend, liberar só a origem exata do front. Nunca `AllowAnyOrigin`.
10. Mudou regra de acesso → adicionar teste em `KhazObras.Security.Tests`.

Lacunas de segurança aceitas no V1: sem rate limit em `/auth/login`; JWT sem revogação/refresh (8h); `.txt` e ZIP renomeado para `.docx/.xlsx` com checagem fraca.

## Notas para o frontend

- Login: `POST /auth/login` → `{ token, expiresAt, userId, name, email, role }`. Enviar `Authorization: Bearer <token>`. Roles: `Master`, `Admin`, `Client`.
- Enums: **respostas** em PascalCase (`"MaoDeObra"`, `"PendingApproval"`); **requests** aceitam snake_case (`"mao_de_obra"`).
- Visão cliente: Hub, Dashboard, Cronograma (sem Curva S), Fechamento (aprovação), Financeiro (somente leitura), Contratos, Relatório fotográfico, Relatório mensal, Projetos. Ver SPEC §5.
- Visão admin/master: navbar do SPEC §6.
- Cliente nunca vê custo real/margem — apenas valores previstos/contratados.

## Lacunas do backend (o front vai esbarrar nelas)

O SPEC não está 100% coberto. Faltam, e provavelmente exigem script `007_*.sql`:
- Contratos e pagamentos (endpoints)
- Dashboard / KPIs / Curva S / Rentabilidade / comparativo entre obras
- Cronograma: atualização de etapas e campo de % concluído
- Categorias (CRUD)
- Empresa / equipe (Administração)
- PUT/PATCH/DELETE na maioria dos módulos
- `GET /users/{id}`, desativar usuário
- Download de anexos de **projetos** pelo cliente da obra (hoje só AdminOrMaster; o de anexos financeiros já é liberado ao cliente para lançamentos `visivel_cliente`)
- Financeiro do cliente: parcelas/pagamentos do contrato (depende do módulo Contratos); o resto da entrega 007 já existe
- Envio real de e-mail / WhatsApp nas notificações
- PDF consolidado (Fase 10)
- Integração do `LogAuditoria` nas ações dos demais módulos (estrutura pronta, não plugada)

Ao encontrar uma dessas lacunas, implementar o endpoint no backend seguindo as convenções acima, antes de construir a tela.

## Decisão em aberto

Possível transformação em SaaS (multi-tenant, nome neutro). Adiada até depois do frontend — não iniciar sem o usuário pedir.