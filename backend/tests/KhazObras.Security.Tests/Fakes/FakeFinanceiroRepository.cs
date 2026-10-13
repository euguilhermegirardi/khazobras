using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeFinanceiroRepository : IFinanceiroLancamentoRepository
{
    private readonly List<FinanceiroLancamento> _lancamentos = [];

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

    public Task<IReadOnlyList<FinanceiroLancamento>> GetByObraIdAsync(Guid obraId)
    {
        var lancamentos = _lancamentos
            .Where(l => l.ObraId == obraId)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<FinanceiroLancamento>>(lancamentos);
    }
}
