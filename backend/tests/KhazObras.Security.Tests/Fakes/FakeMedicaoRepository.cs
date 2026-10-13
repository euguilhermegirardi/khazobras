using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeMedicaoRepository : IMedicaoRepository
{
    private readonly List<Medicao> _medicoes = [];

    public Task<Medicao> CreateAsync(Medicao medicao)
    {
        _medicoes.Add(medicao);
        return Task.FromResult(medicao);
    }

    public Task<Medicao?> GetByIdAsync(Guid id)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        return Task.FromResult(medicao);
    }

    public Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId)
    {
        var medicoes = _medicoes
            .Where(m => m.ObraId == obraId)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<Medicao>>(medicoes);
    }

    public Task ApproveAsync(Guid id, Guid approvedByUserId, DateTime approvedAt)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        if (medicao != null)
        {
            medicao.Status = MedicaoStatus.Approved;
            medicao.ApprovedAt = approvedAt;
            medicao.ApprovedByUserId = approvedByUserId;
            medicao.UpdatedAt = DateTime.UtcNow;
        }

        return Task.CompletedTask;
    }

    public Task IssueInvoiceAsync(Guid id, string nfNumber, DateTime nfIssuedAt)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        if (medicao != null)
        {
            medicao.Status = MedicaoStatus.InvoiceIssued;
            medicao.NfNumber = nfNumber;
            medicao.NfIssuedAt = nfIssuedAt;
            medicao.UpdatedAt = DateTime.UtcNow;
        }

        return Task.CompletedTask;
    }
}
