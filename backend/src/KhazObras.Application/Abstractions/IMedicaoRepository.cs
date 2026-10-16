using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IMedicaoRepository
{
    Task<Medicao> CreateAsync(Medicao medicao);
    Task<Medicao?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId);
    /// <summary>Aprova so se o status atual for pending_approval. Retorna false se nenhuma linha foi afetada.</summary>
    Task<bool> ApproveAsync(Guid id, Guid approvedByUserId, DateTime approvedAt);

    /// <summary>Emite a NF so se o status atual for approved. Retorna false se nenhuma linha foi afetada.</summary>
    Task<bool> IssueInvoiceAsync(Guid id, string nfNumber, DateTime nfIssuedAt);
}