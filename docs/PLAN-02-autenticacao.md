# PLAN 02 — Autenticação e usuários

> **Objetivo da fase:** login funcional com JWT, senha protegida com hash seguro,
> rotas protegidas por `[Authorize]` + Roles, e o primeiro endpoint de gestão de
> usuários (criação restrita ao master).
> **Critério de conclusão:** um usuário master consegue logar via endpoint,
> recebe um JWT válido, e esse token consegue acessar uma rota protegida.

---

## Decisão importante: Identity "manual", não o pacote completo

O `Microsoft.AspNetCore.Identity` completo pressupõe EF Core por baixo (`UserManager`,
`SignInManager` esperam um `DbContext`). Como o projeto usa **Dapper**, vamos:

- **Aproveitar:** `PasswordHasher<TUser>` (hash de senha seguro, sem reinventar
  criptografia) e a infraestrutura de `JwtBearer` + `Claims`/`Roles` para
  autorização
- **Escrever na mão, com Dapper:** o repository que busca/cria usuários na
  tabela `users`, seguindo exatamente o mesmo padrão já usado (Repository +
  `IDbConnection`)

Isso mantém 100% de consistência com o padrão Dapper definido, sem abrir exceção
só para autenticação.

---

## 2.1 — Domain: entidade `User`

Em `KhazObras.Domain`, criar a entidade que representa a tabela `users`
(espelhando `001_create_users.sql`): `Id`, `Name`, `Email`, `PasswordHash`,
`Role` (enum `Master`/`Admin`/`Client`), `InvitedByUserId`, `IsActive`,
`CreatedAt`.

---

## 2.2 — Application: contratos e regras

- DTOs (`sealed record`): `LoginRequest`, `LoginResponse` (token + dados básicos
  do usuário), `CreateUserRequest`
- `IUserRepository` (interface — a implementação real fica na Infrastructure)
- `AuthService`: valida credenciais, gera o JWT
- `UserService`: criação de usuário — valida que só `master` pode chamar
- Validators (FluentValidation) para os DTOs de entrada

---

## 2.3 — Infrastructure: repository + hashing + geração de JWT

- `UserRepository : IUserRepository` — Dapper puro, queries explícitas contra
  `users`
- Uso do `PasswordHasher<User>` do próprio ASP.NET para hash/verificação de senha
- `JwtTokenGenerator` — monta o token com claims (`sub`, `email`, `role`),
  assinado com uma chave secreta (vem da configuração/variável de ambiente)

---

## 2.4 — Api: configuração de autenticação e endpoints

- Registrar `AddAuthentication().AddJwtBearer(...)` e `AddAuthorization` com
  policies por role no `Program.cs`
- Endpoints:
  - `POST /auth/login` — público, devolve o JWT
  - `POST /users` — protegido, `[Authorize(Policy = "MasterOnly")]`
  - `GET /users/me` — protegido, qualquer usuário autenticado, devolve os
    próprios dados (bom endpoint para testar se o token está sendo aceito)

---

## 2.5 — Seed do primeiro usuário master

Sem cadastro público, é preciso inserir o primeiro `master` diretamente no
banco para conseguir logar pela primeira vez. Criar um script de seed
(`database/seed/001_seed_master.sql`) com um usuário master, senha hasheada
gerada previamente.

---

## Checklist de conclusão da fase

- [ ] Entidade `User` no Domain
- [ ] DTOs, validators e services na Application
- [ ] `UserRepository` com Dapper na Infrastructure
- [ ] Hash de senha com `PasswordHasher`
- [ ] Geração e validação de JWT configuradas
- [ ] `POST /auth/login` funcional
- [ ] `POST /users` protegido por policy `MasterOnly`
- [ ] `GET /users/me` como rota protegida de teste
- [ ] Seed do primeiro usuário master
- [ ] Testado via curl: login → token → acesso a rota protegida

**Quando tudo acima estiver marcado → Fase 3 (primeiro CRUD vertical: Obras).**
