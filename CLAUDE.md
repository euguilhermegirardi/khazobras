# CLAUDE.md — KhazObras

Sistema de gerenciamento de obras (Khaz Engenharia): backend .NET 10 + Postgres + Cloudflare R2 (pronto),
frontend React em construção. O usuário (Guilherme) fala português — responda em português.

## Onde está cada coisa

- `docs/SPEC.md` — o quê (funcionalidades, perfis, modelo de dados).
- `docs/PLAN-00-roadmap.md` — fases e status. `PLAN-01`/`PLAN-02`: histórico de fases concluídas
  (consultar só para entender o porquê de uma decisão).
- `docs/design/` — referência visual (HTML anonimizado do engenheiro + capturas): aparência, não funcionalidades.
  Guia: `.claude/rules/frontend-design.md`.
- `docs/NOITE.md` — execução noturna no Mac (`scripts/noite.sh`, launchd, guardas em `.claude/hooks/`).
- `docs/relatorios/` — relatório da manhã de cada ciclo de tela (modelo em `MODELO.md`, métricas no cabeçalho).
- `docs/PLAN-09-frontend.md` — **plano vivo**: status por tela, lacunas do backend, decisões, registro.
- `frontend/CLAUDE.md` — regras do front (carrega ao mexer em `frontend/`).
- `.claude/rules/` — convenções por caminho (backend, banco, componentes e testes do front), sob demanda.
- `.claude/agents/` — `backend-gap-filler`, `frontend-builder`, `frontend-tester`, `design-reviewer`, `security-reviewer`.
- `.claude/skills/` — `ciclo-tela`, `novo-endpoint-backend`, `nova-tela-frontend`, `checagem-pre-commit`.

Fluxo por tela (skill `ciclo-tela`, a sessão principal orquestra): lacuna? → `backend-gap-filler` →
`frontend-builder` → `frontend-tester` → `design-reviewer` ⟲ (falhas voltam ao builder, máx. 3 rodadas, depois
escala ao usuário) → `security-reviewer` (telas com escrita/restrição) → `checagem-pre-commit` → PR.

## Estrutura

```
backend/src/KhazObras.{Api,Application,Domain,Infrastructure}   # Program.cs tem todos os endpoints
backend/tests/KhazObras.Security.Tests                           # inclui Http/ (WebApplicationFactory)
backend/tools/ResetMasterPassword
database/schema/001..008_*.sql                                   # nunca editar script já aplicado
frontend/                                                        # React + Vite + TS
docs/  scripts/  .githooks/
```

## Comandos

```bash
brew services start postgresql@16                              # Postgres local
cd backend && dotnet build && dotnet test tests/KhazObras.Security.Tests
cd backend && dotnet run --project src/KhazObras.Api           # API em :5285 (/healthcheck)
cd backend && dotnet run --project tools/ResetMasterPassword   # redefine a senha do master
cd frontend && npm run dev                                     # front em :5173 (Node 20.19+/22.12+)
cd frontend && npm run format && npm run lint && npm run typecheck && npm test   # format: Prettier (pre-commit confere)
bash scripts/instalar-hooks.sh                                 # uma vez por clone
```

## Plano vivo e trava de commit

Commit que mexe em telas (`frontend/src/modules/**`, exceto testes), `routes/AppRoutes.tsx`, `Program.cs` ou
`database/schema/**` é bloqueado pelo hook se `docs/PLAN-09-frontend.md` não estiver junto.
**Se bloquear, o agente resolve sozinho, sem esperar o usuário**: atualiza status/lacunas/decisões a partir
do `git diff --cached`, roda `cd frontend && npm run plano:registro -- --escrever` (uma linha por branch),
`git add docs/PLAN-09-frontend.md` e commita de novo. `SKIP_PLAN_CHECK=1` ou branch `wip/*` só se o
usuário pedir. Antes do merge: `plano:registro -- --escrever` com tudo commitado + commit `docs: registro`.

## Regras de segurança (inegociáveis — dados extremamente sensíveis)

1. **Nenhum segredo em arquivo versionado.** Só em `appsettings.Development.json` (gitignored) ou variáveis
   de ambiente. `appsettings.json` contém apenas Logging + AllowedHosts.
2. **Antes de todo commit**: `git diff --cached` + grep por segredos (chaves R2, JWT secret, senhas, hashes).
   Achou algo: parar.
3. Sem seed com hash de senha no repositório. O primeiro master é criado fora do git.
4. Endpoint com escopo de obra → `ObraAccessService.EnsureAccessAsync`; `UnauthorizedAccessException` →
   `Results.Forbid()`.
5. Módulos internos (fornecedores, prestadores, estoque, pipeline) → `RequireAuthorization("AdminOrMaster")`.
   Criação de usuários e auditoria → `MasterOnly`.
6. Cliente é somente leitura; única escrita: aprovar medição da própria obra.
7. Cliente nunca vê custo real/margem — só valores previstos/contratados (DTO separado no backend).
8. Todo upload passa por `FileUploadValidator` (10 MB, extensão + MIME + magic bytes). Downloads sempre pela
   API autenticada, nunca URL pública do bucket.
9. Filtrar também por dono no SQL (defense in depth): `WHERE id = @Id AND user_id = @UserId`.
10. CORS só para a origem exata do front (política `Frontend`; dev `http://localhost:5173`, produção
    `Cors__AllowedOrigins__0`). Nunca `AllowAnyOrigin`.
11. Mudou regra de acesso → teste em `KhazObras.Security.Tests` (pipeline HTTP real em `Http/`).

Lacunas aceitas no V1: sem rate limit em `/auth/login`; JWT sem revogação/refresh (8h); `.txt` e ZIP
renomeado para `.docx/.xlsx` com checagem fraca.

## Lacunas do backend

O backend não cobre todo o SPEC. A lista e quais telas cada lacuna bloqueia estão no
`docs/PLAN-09-frontend.md`. Ao esbarrar numa, implementar no backend (`backend-gap-filler`) antes da tela.

## Decisão em aberto

Possível transformação em SaaS (multi-tenant, nome neutro). Adiada até depois do frontend — não iniciar
sem o usuário pedir.
