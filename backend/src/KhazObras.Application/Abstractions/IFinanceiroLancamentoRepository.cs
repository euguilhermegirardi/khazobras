using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IFinanceiroLancamentoRepository
{
    Task<FinanceiroLancamento> CreateAsync(FinanceiroLancamento lancamento);
    Task<FinanceiroLancamento?> GetByIdAsync(Guid id);
    Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(Guid obraId, int pageIndex, int pageSize, bool somenteVisiveisCliente = false);
    Task<Guid?> GetObraIdByIdAsync(Guid id);
    Task<FinanceiroLancamento?> GetByIdAndObraAsync(Guid id, Guid obraId, bool somenteVisiveisCliente);
    /// <summary>UPDATE preso a obra; devolve false se nenhum lancamento dessa obra tem o id.</summary>
    Task<bool> SetVisibilidadeClienteAsync(Guid id, Guid obraId, bool visivelCliente);
    Task<FinanceiroLancamentoAnexo> AddAnexoAsync(FinanceiroLancamentoAnexo anexo);
    Task<Guid?> GetObraIdByAnexoIdAsync(Guid anexoId);
    Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAndObraAsync(Guid anexoId, Guid obraId, bool somenteVisiveisCliente);
}