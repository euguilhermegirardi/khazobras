---
paths:
  - "database/**"
  - "backend/src/KhazObras.Infrastructure/**"
---

# Banco de dados

- Mudança de schema = **novo** script numerado em `database/schema/` (`007_*.sql`, ...). Nunca editar scripts já aplicados.
- Aplicar localmente: `psql -d khazobras_db -f database/schema/00N_*.sql`.
- Enums do Postgres exigem cast explícito no Dapper: `@Status::obra_status`, `@Role::user_role`, `::jsonb`.
- SQL puro com parâmetros nomeados; nunca interpolar string em SQL.
- Filtrar também por dono/obra no SQL (defense in depth), ex.: `WHERE id = @Id AND user_id = @UserId`.
- `database/seed/` é gitignored: nada com hash de senha ou dado real no repositório.
- `DATE` (Postgres) ↔ `DateOnly` (C#) ↔ `DateTime`: atenção às conversões.
