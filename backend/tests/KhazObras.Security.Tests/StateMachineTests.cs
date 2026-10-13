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

        Assert.Equal(MedicaoStatus.PendingApproval, medicao.Status);

        // Act
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);
        var result = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(MedicaoStatus.Approved, result.Status);
        Assert.Equal(admin.Id, result.ApprovedByUserId);
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

        var beforeApproval = DateTime.UtcNow;

        // Act
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, beforeApproval);
        var result = await MedicaoRepository.GetByIdAsync(medicao.Id);

        var afterApproval = DateTime.UtcNow;

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.ApprovedAt);
        Assert.Equal(beforeApproval, result.ApprovedAt);
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

        // First approve
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);

        // Act
        var nfIssuedAt = DateTime.UtcNow;
        await MedicaoRepository.IssueInvoiceAsync(medicao.Id, "NF-2026-001", nfIssuedAt);
        var result = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(MedicaoStatus.InvoiceIssued, result.Status);
        Assert.Equal("NF-2026-001", result.NfNumber);
        Assert.NotNull(result.NfIssuedAt);
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

        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, DateTime.UtcNow);

        var beforeInvoice = DateTime.UtcNow;

        // Act
        await MedicaoRepository.IssueInvoiceAsync(medicao.Id, "NF-001", beforeInvoice);
        var result = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.NfIssuedAt);
        Assert.Equal(beforeInvoice, result.NfIssuedAt);
    }

    [Fact]
    public async Task MedicaoFullWorkflow_PendingApprovalToApprovedToInvoiceIssued()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();
        await CreateEtapaAsync();
        var medicao = await CreateMedicaoAsync();

        // Act 1: Approve
        var approveTime = DateTime.UtcNow;
        await MedicaoRepository.ApproveAsync(medicao.Id, admin.Id, approveTime);
        var approved = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert 1
        Assert.NotNull(approved);
        Assert.Equal(MedicaoStatus.Approved, approved.Status);

        // Act 2: Issue Invoice
        var invoiceTime = DateTime.UtcNow.AddHours(1);
        await MedicaoRepository.IssueInvoiceAsync(medicao.Id, "NF-2026-001", invoiceTime);
        var invoiced = await MedicaoRepository.GetByIdAsync(medicao.Id);

        // Assert 2
        Assert.NotNull(invoiced);
        Assert.Equal(MedicaoStatus.InvoiceIssued, invoiced.Status);
        Assert.Equal("NF-2026-001", invoiced.NfNumber);
        Assert.NotNull(invoiced.ApprovedAt);
        Assert.NotNull(invoiced.NfIssuedAt);
    }

    #endregion

    #region RelatorioMensal State Machine Tests

    [Fact]
    public async Task RelatorioMensalCreate_ShouldInitializeWithDraftStatus()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        // Act
        var relatorio = new Domain.Entities.RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = ObraId,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo = "Test content",
            Status = "draft",
            CreatedByUserId = admin.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await RelatorioMensalRepository.CreateAsync(relatorio);

        // Assert
        Assert.NotNull(created);
        Assert.Equal("draft", created.Status);
        Assert.Null(created.PublishedAt);
    }

    [Fact]
    public async Task RelatorioMensalPublish_FromDraftStatus_ShouldTransitionToPublished()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        var relatorio = new Domain.Entities.RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = ObraId,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo = "Test content",
            Status = "draft",
            CreatedByUserId = admin.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await RelatorioMensalRepository.CreateAsync(relatorio);
        Assert.Equal("draft", created.Status);

        // Act
        var publishTime = DateTime.UtcNow;
        await RelatorioMensalRepository.PublishAsync(created.Id, publishTime);
        var result = await RelatorioMensalRepository.GetByIdAsync(created.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("published", result.Status);
        Assert.NotNull(result.PublishedAt);
    }

    [Fact]
    public async Task RelatorioMensalPublishAsync_ShouldSetPublishedAtTimestamp()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        await CreateObraAsync();

        var relatorio = new Domain.Entities.RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = ObraId,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo = "Test content",
            Status = "draft",
            CreatedByUserId = admin.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await RelatorioMensalRepository.CreateAsync(relatorio);
        var beforePublish = DateTime.UtcNow;

        // Act
        await RelatorioMensalRepository.PublishAsync(created.Id, beforePublish);
        var result = await RelatorioMensalRepository.GetByIdAsync(created.Id);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.PublishedAt);
        Assert.Equal(beforePublish, result.PublishedAt);
    }

    [Fact]
    public async Task RelatorioMensalGetByObraId_ShouldReturnOnlyRelatoriosForThatObra()
    {
        // Arrange
        var admin = await CreateAdminUserAsync();
        await CreateClientUserAsync();
        var obra1 = await CreateObraAsync(id: Guid.NewGuid());
        var obra2 = await CreateObraAsync(id: Guid.NewGuid());

        var relatorio1 = new Domain.Entities.RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = obra1.Id,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo = "Test content 1",
            Status = "draft",
            CreatedByUserId = admin.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var relatorio2 = new Domain.Entities.RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = obra2.Id,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo = "Test content 2",
            Status = "draft",
            CreatedByUserId = admin.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await RelatorioMensalRepository.CreateAsync(relatorio1);
        await RelatorioMensalRepository.CreateAsync(relatorio2);

        // Act
        var obra1Relatorios = await RelatorioMensalRepository.GetByObraIdAsync(obra1.Id);
        var obra2Relatorios = await RelatorioMensalRepository.GetByObraIdAsync(obra2.Id);

        // Assert
        Assert.Single(obra1Relatorios);
        Assert.Single(obra2Relatorios);
        Assert.Equal(relatorio1.Id, obra1Relatorios.First().Id);
        Assert.Equal(relatorio2.Id, obra2Relatorios.First().Id);
    }

    #endregion
}
