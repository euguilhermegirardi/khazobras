using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeFinanceiroRepository : IFinanceiroLancamentoRepository
{
    private readonly List<FinanceiroLancamento> _lancamentos = [];
    private readonly List<FinanceiroLancamentoAnexo> _anexos = [];

    public Task<FinanceiroLancamento> CreateAsync(FinanceiroLancamento lancamento)
    {
        _lancamentos.Add(lancamento);
        return Task.FromResult(lancamento);
    }

    public Task<FinanceiroLancamento?> GetByIdAsync(Guid id)
    {
        var lancamento = _lancamentos.FirstOrDefault(l => l.Id == id);
        return Task.FromResult(lancamento);
    }

    public Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize)
    {
        var totalItems = _lancamentos.Count(l => l.ObraId == obraId);
        var items = _lancamentos
            .Where(l => l.ObraId == obraId)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToList()
            .AsReadOnly();

        return Task.FromResult((items, totalItems));
    }

    public Task<FinanceiroLancamentoAnexo> AddAnexoAsync(FinanceiroLancamentoAnexo anexo)
    {
        _anexos.Add(anexo);
        return Task.FromResult(anexo);
    }

    public Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAsync(Guid anexoId)
    {
        var anexo = _anexos.FirstOrDefault(a => a.Id == anexoId);
        return Task.FromResult(anexo);
    }
}
