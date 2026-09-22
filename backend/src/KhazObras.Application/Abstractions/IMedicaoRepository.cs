using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IMedicaoRepository
{
    Task<Medicao> CreateAsync(Medicao medicao);
    Task<Medicao?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId);
    Task ApproveAsync(Guid id, Guid approvedByUserId, DateTime approvedAt);
    Task IssueInvoiceAsync(Guid id, string nfNumber, DateTime nfIssuedAt);
}