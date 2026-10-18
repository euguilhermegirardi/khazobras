---
name: novo-endpoint-backend
description: Checklist para criar ou completar um endpoint/módulo do backend KhazObras (Minimal API, Clean Architecture, Dapper) com validação, acesso por obra e testes. Use ao implementar uma lacuna do backend.
---

# Novo endpoint no backend

1. **Ler**: SPEC da funcionalidade; endpoint vizinho já pronto (ex.: Etapas ou Medições) como molde.
2. **Schema** (só se precisar): novo `database/schema/00N_*.sql`. Não editar scripts antigos. Usar enums
   do Postgres quando já existem; senão `CHECK`/tabela de apoio.
3. **Domain**: entidade/enum. Status de medição em inglês; resto em português.
4. **Application**:
   - DTOs `sealed record` (request e response separados; DTO distinto para a visão cliente se o
     modelo tem campo interno).
   - Validator FluentValidation (incluir regras entre campos, ex.: fim >= início).
   - Interface em `Abstractions`; service com `CancellationToken`, logs com message templates.
5. **Infrastructure**: repositório Dapper com SQL puro e parâmetros nomeados. Casts de enum
   (`@X::tipo_enum`, `::jsonb`). Multi-tabela: `IDbConnection` + `IDbTransaction`.
   **Todo filtro de visibilidade vai no SQL** (defense in depth, regra 9): dono, obra **e status** (ex.: o
   cliente só vê `published` → `AND status = 'published'::tipo_enum`). Nada de buscar tudo e filtrar com
   `.Where` no service: crie um método próprio no repositório (ex.: `GetPublishedByObraIdAsync`).
6. **Api** (`Program.cs`):
   - Escopo de obra → `ObraAccessService.EnsureAccessAsync`; `UnauthorizedAccessException` → `Results.Forbid()`.
     Vale para **todo** endpoint que recebe id de algo que pertence a uma obra (medição, relatório, etapa...),
     **inclusive os só de Admin/Master** (`IsAdminOrMaster` não substitui: hoje admin vê tudo, mas a regra
     não pode depender disso). Busque o registro, pegue o `ObraId` e chame `EnsureAccessAsync`.
   - Módulo interno → `RequireAuthorization("AdminOrMaster")`; usuários/auditoria → `MasterOnly`.
   - Códigos: 201 criação, 204 sem corpo, 200 com corpo, 404, 403, 409 transição inválida.
   - Listagem: `{ totalItems, pageIndex, pageSize, items }`, `pageIndex` base 0.
7. **DI**: registrar interface/implementação.
8. **Testes** (`KhazObras.Security.Tests`): validator (válido e inválido), regra de acesso (cliente de
   outra obra → 403), transição de estado ilegal → 409, e o que o cliente **não** pode ver (rascunho → 404
   ou ausente da lista; campo interno ausente do JSON). Mudou o repositório? Atualize o fake em `Fakes/`.
9. **Verificar**: `dotnet build` e `dotnet test tests/KhazObras.Security.Tests`.
10. **Documentar**: remover a lacuna da lista em `docs/PLAN-09-frontend.md` e atualizar a tela desbloqueada;
    informar ao front o contrato final (rota, request, response, códigos).
11. Rodar a skill `checagem-pre-commit` antes de commitar.
