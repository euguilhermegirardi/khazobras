using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Abstractions;

public interface IMedicaoRepository
{
    /// <summary>Cria medicao + itens numa transacao. Lanca <see cref="MedicaoNumeroDuplicadoException"/> se (obra, numero) ja existir.</summary>
    Task<Medicao> CreateAsync(Medicao medicao);

    Task<bool> ExistsNumeroAsync(Guid obraId, int numero);

    /// <summary>Resolve so o obra_id da medicao (query enxuta); o endpoint valida o acesso a ela antes de ler/alterar.</summary>
    Task<Guid?> GetObraIdByIdAsync(Guid id);

    /// <summary>Medicao com itens, presa a obra (WHERE id AND obra_id). Outra obra = null.</summary>
    Task<Medicao?> GetByIdAndObraAsync(Guid id, Guid obraId);

    Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId);

    /// <summary>Lista enxuta paginada (mais nova primeiro) para o admin; filtro opcional por status no SQL.</summary>
    Task<(IReadOnlyList<MedicaoResumo> Items, int TotalItems)> GetResumoPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, MedicaoStatus? status);

    /// <summary>Aprova so se o status atual for pending_approval e a medicao for da obra. Retorna false se nenhuma linha foi afetada.</summary>
    Task<bool> ApproveAsync(Guid id, Guid obraId, Guid approvedByUserId, DateTime approvedAt);

    /// <summary>Emite a NF so se o status atual for approved e a medicao for da obra. Retorna false se nenhuma linha foi afetada.</summary>
    Task<bool> IssueInvoiceAsync(Guid id, Guid obraId, string nfNumber, DateTime nfIssuedAt);
}
