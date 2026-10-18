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
        Guid obraId, int pageIndex, int pageSize, bool somenteVisiveisCliente = false)
    {
        var query = _lancamentos
            .Where(l => l.ObraId == obraId && (!somenteVisiveisCliente || l.VisivelCliente));

        var totalItems = query.Count();
        var items = query
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)>((items, totalItems));
    }

    public Task SetVisibilidadeClienteAsync(Guid id, bool visivelCliente)
    {
        var lancamento = _lancamentos.FirstOrDefault(l => l.Id == id);
        if (lancamento is not null)
        {
            lancamento.VisivelCliente = visivelCliente;
        }

        return Task.CompletedTask;
    }

    public Task<FinanceiroLancamentoAnexo> AddAnexoAsync(FinanceiroLancamentoAnexo anexo)
    {
        _anexos.Add(anexo);
        return Task.FromResult(anexo);
    }

    public Task<Guid?> GetObraIdByAnexoIdAsync(Guid anexoId)
    {
        var anexo = _anexos.FirstOrDefault(a => a.Id == anexoId);
        var lancamento = anexo is null ? null : _lancamentos.FirstOrDefault(l => l.Id == anexo.LancamentoId);
        return Task.FromResult<Guid?>(lancamento?.ObraId);
    }

    public Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAndObraAsync(Guid anexoId, Guid obraId, bool somenteVisiveisCliente)
    {
        var anexo = _anexos.FirstOrDefault(a => a.Id == anexoId);
        var lancamento = anexo is null ? null : _lancamentos.FirstOrDefault(l => l.Id == anexo.LancamentoId);
        if (anexo is null || lancamento is null || lancamento.ObraId != obraId || (somenteVisiveisCliente && !lancamento.VisivelCliente))
        {
            return Task.FromResult<FinanceiroLancamentoAnexo?>(null);
        }

        return Task.FromResult<FinanceiroLancamentoAnexo?>(anexo);
    }
}
