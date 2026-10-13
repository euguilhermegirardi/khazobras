using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Domain.Enums;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// Integration tests for end-to-end workflows:
/// Create Obra → Create Etapa → Create Medicao → Approve → Issue Invoice
/// </summary>
public sealed class IntegrationWorkflowTests : IntegrationTestBase
{
    [Fact]
    public async Task CreateObraAsync_WithValidData_ShouldSucceed()
    {
        // Arrange
        await CreateClientUserAsync();

        // Act
        var obra = await CreateObraAsync();

        // Assert
        Assert.NotNull(obra);
        Assert.Equal("Test Obra", obra.Nome);
        Assert.Equal(100000m, obra.ValorContratado);
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
        Assert.Equal(1, etapa.Ordem);
        Assert.Equal(25m, etapa.PercentualPeso);
    }

    [Fact]
    public async Task CreateMedicaoAsync_WithValidData_ShouldInitializeWithPendingApprovalStatus()
    {
        // Arrange
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();

        // Act
        var medicao = await CreateMedicaoAsync();

        // Assert
        Assert.NotNull(medicao);
        Assert.Equal(MedicaoStatus.PendingApproval, medicao.Status);
        Assert.Equal(5000m, medicao.ValorTotal);
        Assert.Single(medicao.Itens);
    }

    [Fact]
    public async Task MedicaoApprove_PendingApprovalToApproved_ShouldSucceed()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        Assert.Equal(MedicaoStatus.PendingApproval, medicao.Status);

        // Act
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);
        var approved = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert
        Assert.NotNull(approved);
        Assert.Equal(MedicaoStatus.Approved, approved.Status);
        Assert.Equal(admin.Id, approved.ApprovedByUserId);
        Assert.NotNull(approved.ApprovedAt);
    }

    [Fact]
    public async Task MedicaoApprove_FromApprovedStatus_ShouldBeIdempotent()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);

        // Act & Assert: Approve again - should work (no state validation in fake repo)
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);
        var result = await MedicaoRepository.GetByIdAsync(medicao.Id);

        Assert.NotNull(result);
        Assert.Equal(MedicaoStatus.Approved, result.Status);
    }

    [Fact]
    public async Task MedicaoIssueInvoice_FromApprovedStatus_ShouldTransitionToInvoiceIssued()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);

        // Act
        await MedicaoRepository.IssueInvoiceAsync(medicao.Id, "NF-2026-001", DateTime.UtcNow);
        var invoiced = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert
        Assert.NotNull(invoiced);
        Assert.Equal(MedicaoStatus.InvoiceIssued, invoiced.Status);
        Assert.Equal("NF-2026-001", invoiced.NfNumber);
        Assert.NotNull(invoiced.NfIssuedAt);
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

        // Act: Approve
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);
        var approved = await MedicaoRepository.GetByIdAsync(medicao.Id);
        Assert.Equal(MedicaoStatus.Approved, approved!.Status);

        // Act: Issue invoice
        await MedicaoRepository.IssueInvoiceAsync(medicao.Id, "NF-2026-001", DateTime.UtcNow);
        var invoiced = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert
        Assert.NotNull(invoiced);
        Assert.Equal(MedicaoStatus.InvoiceIssued, invoiced.Status);
    }

    [Fact]
    public async Task GetObraAsync_ShouldReturnObraById()
    {
        // Arrange
        await CreateClientUserAsync();
        var obra = await CreateObraAsync();

        // Act
        var result = await ObraRepository.GetByIdAsync(obra.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(obra.Id, result.Id);
        Assert.Equal(obra.Nome, result.Nome);
    }

    [Fact]
    public async Task GetMedicoesByObraId_ShouldReturnOnlyMedicoesForThatObra()
    {
        // Arrange
        await CreateClientUserAsync();
        var obra1 = await CreateObraAsync(id: Guid.NewGuid());
        var obra2 = await CreateObraAsync(id: Guid.NewGuid());

        var etapa1 = await CreateEtapaAsync(obraId: obra1.Id, id: Guid.NewGuid());
        var etapa2 = await CreateEtapaAsync(obraId: obra2.Id, id: Guid.NewGuid());

        var medicao1 = await CreateMedicaoAsync(obraId: obra1.Id, id: Guid.NewGuid());
        var medicao2 = await CreateMedicaoAsync(obraId: obra2.Id, id: Guid.NewGuid());

        // Act
        var obra1Medicoes = await MedicaoRepository.GetByObraIdAsync(obra1.Id);
        var obra2Medicoes = await MedicaoRepository.GetByObraIdAsync(obra2.Id);

        // Assert
        Assert.Single(obra1Medicoes);
        Assert.Single(obra2Medicoes);
        Assert.Equal(medicao1.Id, obra1Medicoes.First().Id);
        Assert.Equal(medicao2.Id, obra2Medicoes.First().Id);
    }

    [Fact]
    public async Task GetEtapasByObraId_ShouldReturnOnlyEtapasForThatObra()
    {
        // Arrange
        await CreateClientUserAsync();
        var obra1 = await CreateObraAsync(id: Guid.NewGuid());
        var obra2 = await CreateObraAsync(id: Guid.NewGuid());

        var etapa1 = await CreateEtapaAsync(obraId: obra1.Id, id: Guid.NewGuid());
        var etapa2 = await CreateEtapaAsync(obraId: obra2.Id, id: Guid.NewGuid());

        // Act
        var obra1Etapas = await EtapaRepository.GetByObraIdAsync(obra1.Id);
        var obra2Etapas = await EtapaRepository.GetByObraIdAsync(obra2.Id);

        // Assert
        Assert.Single(obra1Etapas);
        Assert.Single(obra2Etapas);
        Assert.Equal(etapa1.Id, obra1Etapas.First().Id);
        Assert.Equal(etapa2.Id, obra2Etapas.First().Id);
    }
}
