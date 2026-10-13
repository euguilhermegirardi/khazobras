---
paths:
  - "backend/**"
---

# Convenções do backend

- Minimal APIs; Clean Architecture; Dapper + SQL puro (sem EF Core); Repository Pattern.
- Escritas multi-tabela: `IDbConnection` + `IDbTransaction`.
- DTOs: `sealed record`. Valores monetários: `decimal`. Validação: FluentValidation.
- Logs com message templates. `CancellationToken` onde couber.
- Contratos: listagem paginada `{ totalItems, pageIndex, pageSize, items }` (pageIndex base 0); 201 criação; 204 sem corpo; 200 com corpo quando o front precisa do recurso; 409 transição de estado inválida; 403 sem permissão; 404 não encontrado; 500 `{ requestId, message }`.
- Medição: `pending_approval → approved → invoice_issued`. Relatório mensal: `draft → published`.
- Status de medição em inglês; demais nomes em português.

# Armadilhas já pagas

- **Enums do Postgres** exigem cast explícito no Dapper: `@Status::obra_status`, `@Role::user_role`, `::jsonb`.
- **R2 (AWSSDK.S3)**: `ForcePathStyle = true`, `RequestChecksumCalculation` e `ResponseChecksumValidation = WHEN_REQUIRED`, `DisablePayloadSigning = true` no `PutObjectRequest`. Não remover.
- **Config**: `IConfiguration` já lê variáveis de ambiente (`Jwt__Secret`, `ConnectionStrings__Postgres`, `R2__AccessKey`...). Não usar `Environment.GetEnvironmentVariable` manual.
- Em class libs, usar `FindFirst(...)?.Value` (`FindFirstValue` não está disponível).
- `DateOnly` (C#) ↔ `DATE` (Postgres) ↔ `DateTime`: atenção às conversões.
