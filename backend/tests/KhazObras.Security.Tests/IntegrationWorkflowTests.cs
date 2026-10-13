using KhazObras.Application.Services;
using KhazObras.Domain.Enums;
using KhazObras.Security.Tests.Fakes;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// Integration tests for end-to-end workflows:
/// Login → Create Obra → Create Etapa → Create Medicao → Approve → Issue Invoice
/// </summary>
public sealed class IntegrationWorkflowTests : IntegrationTestBase
{
    [Fact]
    public async Task CreateObraAsync_WithValidData_ShouldSucceed()
    {
        // Arrange
        var user = await CreateClientUserAsync();

        // Act
        var obra = await CreateObraAsync(userId: user.Id);

        // Assert
        Assert.NotNull(obra);
        Assert.Equal(user.Id, obra.UserId);
        Assert.Equal("Test Obra", obra.Nome);
        Assert.Equal("Em Progresso", obra.Status);
    }

    [Fact]
    public async Task CreateEtapaAsync_WithValidData_ShouldSucceed()
    {
        // Arrange
        await CreateClientUserAsync();
        var obra = await CreateObraAsync();

        // Act
        var etapa = await CreateEtapaAsync(obraId: obra.Id);

        // Assert
        Assert.NotNull(etapa);
        Assert.Equal(obra.Id, etapa.ObraId);
        Assert.Equal("Test Etapa", etapa.Nome);
    }

    [Fact]
    public async Task CreateMedicaoAsync_WithValidData_ShouldInitializeWithPendingApprovalStatus()
    {
        // Arrange
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);
        var request = new Domain.Dtos.Medicoes.CreateMedicaoRequest
        {
            ObraId = ObraId,
            EtapaId = EtapaId,
            Numero = 1,
            Competencia = "2026-10",
            Itens = new[]
            {
                new Domain.Dtos.Medicoes.MedicaoItemRequest
                {
                    Tipo = "MaoDeObra",
                    Descricao = "Mão de obra",
                    Quantidade = 10,
                    ValorUnitario = 500m
                }
            }
        };

        // Act
        var medicao = await medicaoService.CreateAsync(request);

        // Assert
        Assert.NotNull(medicao);
        Assert.Equal(MedicaoStatus.PendingApproval.ToString(), medicao.Status);
        Assert.Equal(5000m, medicao.ValorTotal);
    }

    [Fact]
    public async Task MedicaoFullWorkflow_PendingApprovalToApprovedToInvoiceIssued_ShouldSucceed()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);
        Assert.Equal(MedicaoStatus.PendingApproval, medicao.Status);

        // Act & Assert: Approve medicao
        var approved = await medicaoService.ApproveAsync(medicao.Id, admin.Id);
        Assert.Equal(MedicaoStatus.Approved, approved.Status);
        Assert.Equal(admin.Id, approved.ApprovedByUserId);
        Assert.NotNull(approved.ApprovedAt);

        // Act & Assert: Issue invoice
        var invoiced = await medicaoService.IssueInvoiceAsync(medicao.Id, "NF-123456");
        Assert.Equal(MedicaoStatus.InvoiceIssued, invoiced.Status);
        Assert.Equal("NF-123456", invoiced.NfNumber);
        Assert.NotNull(invoiced.NfIssuedAt);
    }

    [Fact]
    public async Task ApproveAsync_FromNonPendingApprovalStatus_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);

        // First approval
        await medicaoService.ApproveAsync(medicao.Id, admin.Id);

        // Act & Assert: Try to approve again
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => medicaoService.ApproveAsync(medicao.Id, admin.Id));

        Assert.Contains("nao pode ser aprovada", exception.Message);
    }

    [Fact]
    public async Task IssueInvoiceAsync_WhenNotInApprovedStatus_ShouldThrowInvalidOperationException()
    {
        // Arrange
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);

        // Act & Assert: Try to issue invoice without approving first
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => medicaoService.IssueInvoiceAsync(medicao.Id, "NF-123456"));

        Assert.Contains("so pode ser emitida para medicao aprovada", exception.Message);
    }

    [Fact]
    public async Task GetObraAsync_WhenAccessedByOwner_ShouldReturnObra()
    {
        // Arrange
        var user = await CreateClientUserAsync();
        var obra = await CreateObraAsync(userId: user.Id);

        // Act
        var result = await ObraRepository.GetByIdAsync(obra.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(obra.Id, result.Id);
        Assert.Equal(user.Id, result.UserId);
    }

    [Fact]
    public async Task GetObraAsync_ShouldNotBeAccessibleByDifferentUser()
    {
        // Arrange
        var user1 = await CreateClientUserAsync();
        var user2 = await CreateClientUserAsync(AnotherClientUserId);

        var obra = await CreateObraAsync(userId: user1.Id);

        // Act
        var userObras = await ObraRepository.GetByUserIdAsync(user2.Id);

        // Assert
        var found = userObras.FirstOrDefault(o => o.Id == obra.Id);
        Assert.Null(found);
    }

    [Fact]
    public async Task ObraAccessService_ShouldRejectUnauthorizedAccess()
    {
        // Arrange
        var user1 = await CreateClientUserAsync();
        var user2 = await CreateClientUserAsync(AnotherClientUserId);

        var obra = await CreateObraAsync(userId: user1.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => ObraAccessService.EnsureAccessAsync(obra.Id, user2.Id));

        Assert.NotNull(exception);
    }

    [Fact]
    public async Task ObraAccessService_ShouldAllowAuthorizedAccess()
    {
        // Arrange
        var user = await CreateClientUserAsync();
        var obra = await CreateObraAsync(userId: user.Id);

        // Act & Assert: Should not throw
        await ObraAccessService.EnsureAccessAsync(obra.Id, user.Id);
    }

    [Fact]
    public async Task GetMedicoesByObraId_ShouldReturnOnlyMedicoesForThatObra()
    {
        // Arrange
        var user = await CreateClientUserAsync();
        var obra1 = await CreateObraAsync(userId: user.Id, id: Guid.NewGuid());
        var obra2 = await CreateObraAsync(userId: user.Id, id: Guid.NewGuid());

        var etapa1 = await CreateEtapaAsync(obraId: obra1.Id, id: Guid.NewGuid());
        var etapa2 = await CreateEtapaAsync(obraId: obra2.Id, id: Guid.NewGuid());

        var medicao1 = await CreateMedicaoAsync(obraId: obra1.Id, etapaId: etapa1.Id, id: Guid.NewGuid());
        var medicao2 = await CreateMedicaoAsync(obraId: obra2.Id, etapaId: etapa2.Id, id: Guid.NewGuid());

        // Act
        var obra1Medicoes = await MedicaoRepository.GetByObraIdAsync(obra1.Id);
        var obra2Medicoes = await MedicaoRepository.GetByObraIdAsync(obra2.Id);

        // Assert
        Assert.Single(obra1Medicoes);
        Assert.Single(obra2Medicoes);
        Assert.Equal(medicao1.Id, obra1Medicoes.First().Id);
        Assert.Equal(medicao2.Id, obra2Medicoes.First().Id);
    }
}
