using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IFinanceiroLancamentoRepository
{
    Task<FinanceiroLancamento> CreateAsync(FinanceiroLancamento lancamento);
    Task<FinanceiroLancamento?> GetByIdAsync(Guid id);
    Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(Guid obraId, int pageIndex, int pageSize);
    Task<FinanceiroLancamentoAnexo> AddAnexoAsync(FinanceiroLancamentoAnexo anexo);
    Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAsync(Guid anexoId);
}