# Fase 3 — Plano de Testes de Integração
**Data:** 2026-10-13  
**Status:** ⏳ Em Progresso

---

## Objetivo
Implementar testes de integração abrangentes para validar fluxos ponta-a-ponta, máquinas de estado, validação e controle de acesso do backend KhazObras.

---

## Estrutura de Testes

### 1. **Testes de Fluxo Ponta-a-Ponta** (Integration Workflow Tests)
**Arquivo:** `IntegrationWorkflowTests.cs`

Validar fluxo completo: Login → Criar Obra → Criar Etapa → Criar Medição → Aprovar → Faturar

#### Testes:
- `LoginAndCreateObraAsync` — Login bem-sucedido, criar obra, validar resposta
- `CreateEtapaAndMedicaoAsync` — Criar etapa, criar medição, validar estado
- `MedicaoFullWorkflowAsync` — Medição: PendingApproval → Approved → InvoiceIssued
- `UnauthorizedAccessToAnotherUsersObraAsync` — IDOR: usuário não consegue ver obra de outro

#### Fake Repositories Necessárias:
- `FakeUserRepository`
- `FakeObraRepository`
- `FakeEtapaRepository`
- `FakeMedicaoRepository`
- `FakeFinanceiroRepository`

---

### 2. **Testes de Máquina de Estado** (State Machine Tests)
**Arquivo:** `StateMachineTests.cs`

Validar transições de estado corretas e rejeição de transições inválidas.

#### 2.1 Medição State Machine
Estados: `PendingApproval` → `Approved` → `InvoiceIssued`

Testes:
- `MedicaoApproveAsync_ShouldTransitionFromPendingApprovalToApproved`
- `MedicaoApproveAsync_ShouldRejectWhenNotInPendingApprovalStatus`
- `MedicaoIssueInvoiceAsync_ShouldTransitionFromApprovedToInvoiceIssued`
- `MedicaoIssueInvoiceAsync_ShouldRejectWhenNotInApprovedStatus`
- `MedicaoIssueInvoiceAsync_ShouldRejectIfNfNumberAlreadyExists`

#### 2.2 Relatório Mensal State Machine
Estados: `draft` → `published`

Testes:
- `RelatorioMensalPublishAsync_ShouldTransitionFromDraftToPublished`
- `RelatorioMensalPublishAsync_ShouldRejectWhenAlreadyPublished`
- `RelatorioMensalPublishAsync_ShouldSetPublishedAtTimestamp`

---

### 3. **Testes de Validação (FluentValidation Tests)**
**Arquivo:** `ValidatorTests.cs`

Testar todas as regras de validação em DTOs.

#### 3.1 CreateUserRequestValidator
- Email válido (RFC 5322)
- Email duplicado
- Senha mínima (8 chars, maiúscula, número)
- Role válido (Master, Admin, Client)

#### 3.2 CreateObraRequestValidator
- Nome obrigatório
- Endereço obrigatório
- Data de início ≤ data de fim
- ValorContratado > 0

#### 3.3 CreateMedicaoRequestValidator
- ObraId válido
- EtapaId válido
- Itens não vazios
- ValorUnitario > 0
- Quantidade > 0

#### 3.4 CreateFinanceiroLancamentoRequestValidator
- Tipo válido (Receita, Despesa)
- Valor > 0
- Data não no futuro

#### 3.5 CreateRelatorioFotograficoRequestValidator
- ObraId válido
- Fotos não vazias

#### 3.6 CreateRelatorioMensalRequestValidator
- ObraId válido
- Competência em formato válido (yyyy-MM)
- Conteudo não vazio

#### 3.7 CreateEtapaRequestValidator
- ObraId válido
- Nome obrigatório
- Datas válidas (início ≤ fim)

---

### 4. **Testes de Controle de Acesso (IDOR Prevention Tests)**
**Arquivo:** `AccessControlTests.cs`

Validar que usuários só conseguem acessar seus próprios dados.

#### Testes:
- `GetObraAsync_ShouldRejectAccessFromDifferentUser`
- `UpdateMedicaoAsync_ShouldRejectAccessFromDifferentUser`
- `ApproveMedicaoAsync_ShouldRejectIfNotObraOwner`
- `MarkNotificacaoAsReadAsync_ShouldRejectIfNotOwner`
- `GetFinanceiroAsync_ShouldRejectIfNotObraOwner`

#### Repositórios com Segurança:
- Todas as queries filtram por `user_id` (defense in depth)
- Transações multi-tabela preservam filtros

---

### 5. **Testes de Validação de Arquivo (File Upload Tests)**
**Arquivo:** `FileUploadValidatorTests.cs` (melhorar existentes)

Adicionar mais casos:
- PDF válido com magic bytes `%PDF-1.4`
- Excel válido com magic bytes `PK\x03\x04` (ZIP)
- Imagem inválida (texto renomeado para .jpg)
- Tamanho máximo (10 MB)
- Extensão inválida

---

### 6. **Testes de Autenticação e Autorização**
**Arquivo:** `AuthenticationTests.cs`

#### Testes:
- `LoginAsync_WithValidCredentials_ShouldReturnJwtToken`
- `LoginAsync_WithInvalidCredentials_ShouldThrowUnauthorizedException`
- `LoginAsync_WithNonExistentEmail_ShouldThrowUnauthorizedException`
- `PasswordHasher_ShouldNotReturnPlaintextPassword`
- `JwtTokenGenerator_ShouldSetExpirationTo8Hours`

---

## Infraestrutura de Testes

### Base Test Fixture (`TestFixture.cs`)

```csharp
public abstract class IntegrationTestBase
{
    protected readonly FakeUserRepository UserRepository;
    protected readonly FakeObraRepository ObraRepository;
    protected readonly FakeMedicaoRepository MedicaoRepository;
    // ... outros repositórios
    
    protected Guid AdminUserId { get; } = Guid.NewGuid();
    protected Guid ClientUserId { get; } = Guid.NewGuid();
    protected Guid ObraId { get; } = Guid.NewGuid();
    
    protected IntegrationTestBase()
    {
        // Setup fake data
        UserRepository = new FakeUserRepository();
        ObraRepository = new FakeObraRepository();
        MedicaoRepository = new FakeMedicaoRepository();
    }
}
```

### Padrão de Teste Fake Repository

```csharp
public sealed class FakeMedicaoRepository : IMedicaoRepository
{
    private readonly List<Medicao> _medicoes = [];
    
    public async Task<Medicao> CreateAsync(Medicao medicao)
    {
        _medicoes.Add(medicao);
        return await Task.FromResult(medicao);
    }
    
    public async Task<Medicao?> GetByIdAsync(Guid id) =>
        await Task.FromResult(_medicoes.FirstOrDefault(m => m.Id == id));
    
    // ... outros métodos
}
```

---

## Checklist de Implementação

| Teste | Status | Arquivo |
|-------|--------|---------|
| **Fluxo Ponta-a-Ponta** |  |  |
| LoginAndCreateObraAsync | ⏳ | IntegrationWorkflowTests.cs |
| CreateEtapaAndMedicaoAsync | ⏳ | IntegrationWorkflowTests.cs |
| MedicaoFullWorkflowAsync | ⏳ | IntegrationWorkflowTests.cs |
| UnauthorizedAccessToAnotherUsersObraAsync | ⏳ | IntegrationWorkflowTests.cs |
| **Máquina de Estado** |  |  |
| MedicaoApprove StateTransitions | ⏳ | StateMachineTests.cs |
| MedicaoIssueInvoice StateTransitions | ⏳ | StateMachineTests.cs |
| RelatorioMensalPublish StateTransitions | ⏳ | StateMachineTests.cs |
| **Validação** |  |  |
| CreateUserValidator (5 cases) | ⏳ | ValidatorTests.cs |
| CreateObraValidator (4 cases) | ⏳ | ValidatorTests.cs |
| CreateMedicaoValidator (4 cases) | ⏳ | ValidatorTests.cs |
| CreateFinanceiroValidator (3 cases) | ⏳ | ValidatorTests.cs |
| Other Validators (14 cases) | ⏳ | ValidatorTests.cs |
| **Controle de Acesso** |  |  |
| IDOR Prevention (5 cases) | ⏳ | AccessControlTests.cs |
| **Autenticação** |  |  |
| Login Success/Failure (5 cases) | ⏳ | AuthenticationTests.cs |
| **Upload** |  |  |
| File Validation (6 cases, existing 5) | ✅ | FileUploadValidatorTests.cs |

---

## Executar Testes

```bash
cd backend
dotnet test tests/KhazObras.Security.Tests --logger "console;verbosity=detailed"
```

**Target:** 50+ testes passando, cobertura >80% dos serviços críticos.

---

## Próximas Fases

- **Fase 4:** Skills (novo endpoint template, novo teste template, guia de contribuição)
- **Fase 5:** Deployment (Docker, CI/CD GitHub Actions)

---

**Atualizado em:** 2026-10-13  
**Responsável:** Claude (AI Assistant)
