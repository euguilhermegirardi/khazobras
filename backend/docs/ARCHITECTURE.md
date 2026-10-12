# KhazObras — Diagrama de Arquitetura

```mermaid
graph TB
    subgraph Client["🖥️ Cliente (Frontend)"]
        Web["React + Vite<br/>(Fase 9)"]
    end
    
    subgraph API["📡 API Layer (KhazObras.Api)"]
        Endpoints["Minimal APIs<br/>48 Endpoints<br/>Program.cs"]
        Auth["Authentication<br/>JWT + Roles"]
    end
    
    subgraph App["🧠 Application Layer (KhazObras.Application)"]
        Services["Services<br/>Auth, Obra, Medicao<br/>Financeiro, Relatórios..."]
        DTOs["DTOs & Contracts<br/>sealed record<br/>Paginação"]
        Validators["FluentValidation<br/>30+ Validators"]
    end
    
    subgraph Domain["🏛️ Domain Layer (KhazObras.Domain)"]
        Entities["Entities<br/>Obra, Medicao<br/>Etapa, Financeiro..."]
        Enums["Enums<br/>UserRole, ObraStatus<br/>MedicaoStatus..."]
        Abstractions["Abstractions<br/>IRepository<br/>IValidator..."]
    end
    
    subgraph Infra["🔧 Infrastructure Layer (KhazObras.Infrastructure)"]
        Repos["Repositories<br/>Dapper + SQL Puro<br/>Defense in Depth"]
        Storage["Storage Service<br/>Cloudflare R2<br/>S3-compatible"]
        DB["Database<br/>PostgreSQL 16<br/>22 Tables"]
    end
    
    subgraph External["☁️ External Services"]
        R2["Cloudflare R2<br/>(Upload/Download)"]
    end
    
    Client -->|HTTP| Endpoints
    Endpoints -->|Inject| Auth
    Endpoints -->|Inject| Services
    Services -->|Use| DTOs
    Services -->|Validate| Validators
    Services -->|Query| Repos
    
    Repos -->|Access| Domain
    Repos -->|JDBC| DB
    Storage -->|Upload/Download| R2
    Services -->|Use| Storage
    
    style Client fill:#e1f5ff
    style API fill:#fff3e0
    style App fill:#f3e5f5
    style Domain fill:#e8f5e9
    style Infra fill:#fce4ec
    style External fill:#eeeeee
```

## Fluxo de Dados: Login → Criar Obra → Medição

```mermaid
sequenceDiagram
    actor User as User (Client)
    participant API as Minimal API
    participant Auth as AuthService
    participant ObraService as ObraService
    participant Repo as ObraRepository
    participant DB as PostgreSQL
    
    User->>API: POST /auth/login
    API->>Auth: LoginAsync(email, password)
    Auth->>Repo: GetByEmailAsync()
    Repo->>DB: SELECT * FROM users WHERE email=?
    DB-->>Repo: User + Hash
    Auth-->>API: { token, expiresAt, userId, role }
    API-->>User: 200 OK (JWT)
    
    User->>API: POST /obras (com Bearer token)
    API->>API: ValidateToken(Bearer)
    API->>ObraService: CreateAsync(request)
    ObraService->>Repo: CreateAsync(obra)
    Repo->>DB: INSERT INTO obras (...) RETURNING *
    DB-->>Repo: Created Obra
    Repo-->>ObraService: ObraResponse
    ObraService-->>API: ObraResponse
    API-->>User: 201 Created
    
    Note over API,User: Medição (aprovação por Cliente)
    User->>API: POST /medicoes/{id}/approve
    API->>API: ValidateToken + ObraAccessService.EnsureAccessAsync()
    API->>MedicaoService: ApproveAsync(medicaoId, userId)
    MedicaoService->>Repo: GetByIdAsync(medicaoId)
    Repo->>DB: SELECT * FROM medicoes WHERE id=? AND user_id=?
    DB-->>Repo: Medicao (pending_approval)
    MedicaoService->>DB: UPDATE medicoes SET status='approved'
    API-->>User: 200 OK (Medicao {status: Approved})
```

## Segurança em Camadas

```mermaid
graph LR
    subgraph Request["🔐 Request"]
        JWT["JWT Token<br/>Validação"]
        Role["Role-based<br/>Authorization"]
    end
    
    subgraph Service["🔐 Service"]
        Access["ObraAccessService<br/>IDOR Prevention<br/>per usuário"]
        Transition["State Machine<br/>Validação de<br/>Transições"]
    end
    
    subgraph SQL["🔐 SQL"]
        Filter["Defense in Depth<br/>WHERE user_id = @UserId<br/>AND obra_id = @ObraId"]
    end
    
    subgraph Files["🔐 Files"]
        MagicBytes["Magic Bytes Check<br/>+ MIME + Extensão<br/>10MB Max"]
    end
    
    Request -->|autorizado?| Service
    Service -->|acesso válido?| SQL
    Files -->|upload válido?| Service
    
    style Request fill:#ffebee
    style Service fill:#fce4ec
    style SQL fill:#f8bbd0
    style Files fill:#f48fb1
```

## Stack Tecnológico

| Camada | Tecnologia | Propósito |
|---|---|---|
| **Apresentação** | ASP.NET Core Minimal APIs | Endpoints REST com configuração declarativa |
| **Autenticação** | JWT + Roles | Stateless auth, claims-based authorization |
| **Validação** | FluentValidation | Regras de negócio em DTO |
| **Persistência** | Dapper + SQL Puro | Controle fino, queries otimizadas |
| **Banco de Dados** | PostgreSQL 16 | ACID, Enums nativos, jsonb |
| **Storage** | Cloudflare R2 | S3-compatible, upload/download de arquivos |
| **Testes** | xUnit + Fakes | Security tests (5), plano para integração |
| **Logging** | Serilog (config) | Message templates, estruturado |
| **Tratamento de Erro** | Global Exception Handler | ProblemDetails RFC 9110 |

## Clean Architecture — Responsabilidades

```
KhazObras.Api (Program.cs, 925 linhas)
├─ Configura DI
├─ Define 48 endpoints (Minimal APIs)
├─ Aplica autenticação & autorização
└─ Mapeia OpenAPI (agora sempre ativo, não só Development)

KhazObras.Application (77 arquivos)
├─ Services: Orquestração de lógica
├─ DTOs: Contratos (sealed record)
├─ Validators: Regras de validação (FluentValidation)
└─ Abstractions: Interfaces (IRepository, etc.)

KhazObras.Domain (23 arquivos)
├─ Entities: Modelos de domínio
├─ Enums: Estados (ObraStatus, MedicaoStatus, UserRole)
└─ Abstractions: Contratos de acesso

KhazObras.Infrastructure (21 arquivos)
├─ Repositories: Dapper + SQL (Repository Pattern)
├─ Storage: R2StorageService
├─ Persistence: IDbConnectionFactory, NpgsqlConnectionFactory
└─ Security: PasswordHasher, JwtTokenGenerator
```

## Fases do Projeto

```mermaid
gantt
    title Roadmap KhazObras (Fases 1-10)
    
    section Backend
    Fase 1 - Fundação : done, f1, 2026-09-01, 30d
    Fase 2 - Autenticação : done, f2, 2026-10-01, 20d
    Fase 3 - CRUD : done, f3, 2026-10-15, 25d
    Fase 4 - Medições : done, f4, 2026-10-20, 20d
    Fase 5 - Financeiro : done, f5, 2026-11-01, 25d
    Fase 6 - Relatórios : done, f6, 2026-11-15, 25d
    Fase 7 - Interno : done, f7, 2026-12-01, 20d
    Fase 8 - Finalização : done, f8, 2026-12-15, 15d
    
    section Documentation
    Audit : active, audit, 2026-10-12, 1d
    API.md : active, api, 2026-10-12, 1d
    Diagrams : crit, diagrams, 2026-10-12, 1d
    Postman : diag, postman, 2026-10-13, 1d
    
    section Frontend
    Fase 9 - React UI : f9, 2026-12-20, 60d
    Fase 10 - PDF & Email : f10, 2027-02-15, 30d
```

---

**Atualizado em:** 2026-10-12  
**Versão:** 1.0
