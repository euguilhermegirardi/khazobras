using KhazObras.Application.Services;
using KhazObras.Domain.Enums;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// Tests for state machine transitions:
/// - Medicao: PendingApproval → Approved → InvoiceIssued
/// - RelatorioMensal: draft → published
/// </summary>
public sealed class StateMachineTests : IntegrationTestBase
{
    #region Medicao State Machine Tests

    [Fact]
    public async Task MedicaoApprove_FromPendingApproval_ShouldTransitionToApproved()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);
        Assert.Equal(MedicaoStatus.PendingApproval, medicao.Status);

        // Act
        var result = await medicaoService.ApproveAsync(medicao.Id, admin.Id);

        // Assert
        Assert.Equal(MedicaoStatus.Approved, result.Status);
        Assert.Equal(admin.Id, result.ApprovedByUserId);
    }

    [Fact]
    public async Task MedicaoApprove_FromApprovedStatus_ShouldThrow()
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

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => medicaoService.ApproveAsync(medicao.Id, admin.Id));

        Assert.Contains("nao pode ser aprovada", exception.Message);
    }

    [Fact]
    public async Task MedicaoApprove_FromInvoiceIssuedStatus_ShouldThrow()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);

        // Full workflow: PendingApproval → Approved → InvoiceIssued
        await medicaoService.ApproveAsync(medicao.Id, admin.Id);
        await medicaoService.IssueInvoiceAsync(medicao.Id, "NF-001");

        // Act & Assert: Try to approve invoice-issued medicao
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => medicaoService.ApproveAsync(medicao.Id, admin.Id));

        Assert.Contains("nao pode ser aprovada", exception.Message);
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

        var medicaoService = new MedicaoService(MedicaoRepository);

        // Approve first
        await medicaoService.ApproveAsync(medicao.Id, admin.Id);

        // Act
        var result = await medicaoService.IssueInvoiceAsync(medicao.Id, "NF-2026-001");

        // Assert
        Assert.Equal(MedicaoStatus.InvoiceIssued, result.Status);
        Assert.Equal("NF-2026-001", result.NfNumber);
        Assert.NotNull(result.NfIssuedAt);
    }

    [Fact]
    public async Task MedicaoIssueInvoice_FromPendingApprovalStatus_ShouldThrow()
    {
        // Arrange
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);
        Assert.Equal(MedicaoStatus.PendingApproval, medicao.Status);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => medicaoService.IssueInvoiceAsync(medicao.Id, "NF-001"));

        Assert.Contains("so pode ser emitida para medicao aprovada", exception.Message);
    }

    [Fact]
    public async Task MedicaoIssueInvoice_FromInvoiceIssuedStatus_ShouldThrow()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);

        // Full workflow
        await medicaoService.ApproveAsync(medicao.Id, admin.Id);
        await medicaoService.IssueInvoiceAsync(medicao.Id, "NF-001");

        // Act & Assert: Try to issue invoice again
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => medicaoService.IssueInvoiceAsync(medicao.Id, "NF-002"));

        Assert.Contains("so pode ser emitida para medicao aprovada", exception.Message);
    }

    [Fact]
    public async Task MedicaoApproveAsync_ShouldSetApprovedAtTimestamp()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);
        var beforeApproval = DateTime.UtcNow;

        // Act
        var result = await medicaoService.ApproveAsync(medicao.Id, admin.Id);

        var afterApproval = DateTime.UtcNow;

        // Assert
        Assert.NotNull(result.ApprovedAt);
        Assert.True(result.ApprovedAt >= beforeApproval);
        Assert.True(result.ApprovedAt <= afterApproval);
    }

    [Fact]
    public async Task MedicaoIssueInvoiceAsync_ShouldSetNfIssuedAtTimestamp()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        var medicaoService = new MedicaoService(MedicaoRepository);
        await medicaoService.ApproveAsync(medicao.Id, admin.Id);

        var beforeInvoice = DateTime.UtcNow;

        // Act
        var result = await medicaoService.IssueInvoiceAsync(medicao.Id, "NF-001");

        var afterInvoice = DateTime.UtcNow;

        // Assert
        Assert.NotNull(result.NfIssuedAt);
        Assert.True(result.NfIssuedAt >= beforeInvoice);
        Assert.True(result.NfIssuedAt <= afterInvoice);
    }

    #endregion

    #region RelatorioMensal State Machine Tests

    [Fact]
    public async Task RelatorioMensalPublish_FromDraftStatus_ShouldTransitionToPublished()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        var relatorioService = new RelatorioMensalService(RelatorioMensalRepository);
        var request = new Domain.Dtos.RelatoriosMensais.CreateRelatorioMensalRequest
        {
            ObraId = ObraId,
            Competencia = "2026-10",
            Conteudo = "Test content"
        };

        var created = await relatorioService.CreateAsync(request, admin.Id);
        Assert.Equal("draft", created.Status);

        // Act
        var result = await relatorioService.PublishAsync(created.Id);

        // Assert
        Assert.Equal("published", result.Status);
        Assert.NotNull(result.PublishedAt);
    }

    [Fact]
    public async Task RelatorioMensalPublish_FromPublishedStatus_ShouldThrow()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        var relatorioService = new RelatorioMensalService(RelatorioMensalRepository);
        var request = new Domain.Dtos.RelatoriosMensais.CreateRelatorioMensalRequest
        {
            ObraId = ObraId,
            Competencia = "2026-10",
            Conteudo = "Test content"
        };

        var created = await relatorioService.CreateAsync(request, admin.Id);

        // First publish
        await relatorioService.PublishAsync(created.Id);

        // Act & Assert: Try to publish again
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => relatorioService.PublishAsync(created.Id));

        Assert.Contains("ja esta publicado", exception.Message);
    }

    [Fact]
    public async Task RelatorioMensalPublishAsync_ShouldSetPublishedAtTimestamp()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        var relatorioService = new RelatorioMensalService(RelatorioMensalRepository);
        var request = new Domain.Dtos.RelatoriosMensais.CreateRelatorioMensalRequest
        {
            ObraId = ObraId,
            Competencia = "2026-10",
            Conteudo = "Test content"
        };

        var created = await relatorioService.CreateAsync(request, admin.Id);
        var beforePublish = DateTime.UtcNow;

        // Act
        var result = await relatorioService.PublishAsync(created.Id);

        var afterPublish = DateTime.UtcNow;

        // Assert
        Assert.NotNull(result.PublishedAt);
        Assert.True(result.PublishedAt >= beforePublish);
        Assert.True(result.PublishedAt <= afterPublish);
    }

    [Fact]
    public async Task RelatorioMensalCreate_ShouldInitializeWithDraftStatus()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        var relatorioService = new RelatorioMensalService(RelatorioMensalRepository);
        var request = new Domain.Dtos.RelatoriosMensais.CreateRelatorioMensalRequest
        {
            ObraId = ObraId,
            Competencia = "2026-10",
            Conteudo = "Test content"
        };

        // Act
        var result = await relatorioService.CreateAsync(request, admin.Id);

        // Assert
        Assert.Equal("draft", result.Status);
        Assert.Null(result.PublishedAt);
    }

    #endregion
}
