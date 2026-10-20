using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeFinanceiroRepository : IFinanceiroLancamentoRepository
{
    private readonly List<FinanceiroLancamento> _lancamentos = [];
    private readonly List<FinanceiroLancamentoAnexo> _anexos = [];

    /// <summary>Quantos lancamentos existem (qualquer obra) — para provar que um pedido recusado nao alterou nada.</summary>
    public int TotalLancamentos => _lancamentos.Count;

    public Task<FinanceiroLancamento> CreateAsync(FinanceiroLancamento lancamento)
    {
        _lancamentos.Add(lancamento);
        return Task.FromResult(lancamento);
    }

    public Task<FinanceiroLancamento?> GetByIdAsync(Guid id)
    {
        var lancamento = _lancamentos.FirstOrDefault(l => l.Id == id);
        return Task.FromResult(lancamento is null ? null : ComAnexos(lancamento));
    }

    public Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, bool somenteVisiveisCliente = false, FinanceiroFiltro? filtro = null)
    {
        var query = _lancamentos
            .Where(l => l.ObraId == obraId && (!somenteVisiveisCliente || l.VisivelCliente))
            .Where(l => filtro?.VisivelCliente is null || l.VisivelCliente == filtro.VisivelCliente)
            .Where(l => filtro?.Categoria is null || l.Categoria == filtro.Categoria)
            .Where(l => filtro?.Competencia is null
                        || (l.MesCompetencia.Year == filtro.Competencia.Value.Year && l.MesCompetencia.Month == filtro.Competencia.Value.Month))
            .OrderByDescending(l => l.DataLancamento)
            .ThenByDescending(l => l.CreatedAt)
            .ToList();

        var totalItems = query.Count;
        var items = query
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(ComAnexos)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)>((items, totalItems));
    }

    public Task<FinanceiroResumo> GetResumoByObraIdAsync(Guid obraId)
    {
        var da = _lancamentos.Where(l => l.ObraId == obraId).ToList();
        var liberados = da.Where(l => l.VisivelCliente).ToList();
        var ocultos = da.Where(l => !l.VisivelCliente).ToList();
        return Task.FromResult(new FinanceiroResumo(
            da.Sum(l => l.Valor), liberados.Sum(l => l.Valor), ocultos.Sum(l => l.Valor),
            da.Count, liberados.Count, ocultos.Count));
    }

    public Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        var lancamento = _lancamentos.FirstOrDefault(l => l.Id == id);
        return Task.FromResult<Guid?>(lancamento?.ObraId);
    }

    public Task<FinanceiroLancamento?> GetByIdAndObraAsync(Guid id, Guid obraId, bool somenteVisiveisCliente)
    {
        var lancamento = _lancamentos.FirstOrDefault(l =>
            l.Id == id && l.ObraId == obraId && (!somenteVisiveisCliente || l.VisivelCliente));
        return Task.FromResult(lancamento is null ? null : ComAnexos(lancamento));
    }

    public Task<bool> UpdateAsync(FinanceiroLancamento lancamento)
    {
        var existente = _lancamentos.FirstOrDefault(l => l.Id == lancamento.Id && l.ObraId == lancamento.ObraId);
        if (existente is null)
        {
            return Task.FromResult(false);
        }

        existente.Categoria = lancamento.Categoria;
        existente.Descricao = lancamento.Descricao;
        existente.Valor = lancamento.Valor;
        existente.DataLancamento = lancamento.DataLancamento;
        existente.MesCompetencia = lancamento.MesCompetencia;
        existente.VisivelCliente = lancamento.VisivelCliente;
        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId)
    {
        var existente = _lancamentos.FirstOrDefault(l => l.Id == id && l.ObraId == obraId);
        if (existente is null)
        {
            return Task.FromResult<IReadOnlyList<string>?>(null);
        }

        var removidos = _anexos.Where(a => a.LancamentoId == id).ToList();
        _anexos.RemoveAll(a => a.LancamentoId == id);
        _lancamentos.Remove(existente);
        return Task.FromResult<IReadOnlyList<string>?>(removidos.Select(a => a.StorageKey).ToList());
    }

    public Task<bool> SetVisibilidadeClienteAsync(Guid id, Guid obraId, bool visivelCliente)
    {
        var lancamento = _lancamentos.FirstOrDefault(l => l.Id == id && l.ObraId == obraId);
        if (lancamento is null)
        {
            return Task.FromResult(false);
        }

        lancamento.VisivelCliente = visivelCliente;
        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<(Guid Id, bool VisivelAnterior)>?> SetVisibilidadeLoteAsync(Guid obraId, IReadOnlyList<Guid> ids, bool visivelCliente)
    {
        var alvo = _lancamentos.Where(l => l.ObraId == obraId && ids.Contains(l.Id)).ToList();
        if (alvo.Count != ids.Count)
        {
            return Task.FromResult<IReadOnlyList<(Guid Id, bool VisivelAnterior)>?>(null);
        }

        var anteriores = alvo.Select(l => (l.Id, l.VisivelCliente)).ToList();
        foreach (var lancamento in alvo)
        {
            lancamento.VisivelCliente = visivelCliente;
        }

        return Task.FromResult<IReadOnlyList<(Guid Id, bool VisivelAnterior)>?>(anteriores);
    }

    /// <summary>Semeia um anexo direto (sem limite nem checagem de obra), para montar cenarios de teste.</summary>
    public Task<FinanceiroLancamentoAnexo> AddAnexoAsync(FinanceiroLancamentoAnexo anexo)
    {
        _anexos.Add(anexo);
        return Task.FromResult(anexo);
    }

    public Task<bool> TryAddAnexoAsync(FinanceiroLancamentoAnexo anexo, Guid obraId, int maxAnexos)
    {
        var lancamento = _lancamentos.FirstOrDefault(l => l.Id == anexo.LancamentoId && l.ObraId == obraId);
        if (lancamento is null || _anexos.Count(a => a.LancamentoId == lancamento.Id) >= maxAnexos)
        {
            return Task.FromResult(false);
        }

        _anexos.Add(anexo);
        return Task.FromResult(true);
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

    public Task<FinanceiroLancamentoAnexo?> DeleteAnexoAsync(Guid anexoId, Guid obraId)
    {
        var anexo = _anexos.FirstOrDefault(a => a.Id == anexoId);
        var lancamento = anexo is null ? null : _lancamentos.FirstOrDefault(l => l.Id == anexo.LancamentoId);
        if (anexo is null || lancamento is null || lancamento.ObraId != obraId)
        {
            return Task.FromResult<FinanceiroLancamentoAnexo?>(null);
        }

        _anexos.Remove(anexo);
        return Task.FromResult<FinanceiroLancamentoAnexo?>(anexo);
    }

    /// <summary>Copia com os anexos atuais, como o repositorio real (que le uma linha nova a cada consulta).</summary>
    private FinanceiroLancamento ComAnexos(FinanceiroLancamento l) => new()
    {
        Id = l.Id,
        ObraId = l.ObraId,
        Categoria = l.Categoria,
        Descricao = l.Descricao,
        Valor = l.Valor,
        DataLancamento = l.DataLancamento,
        MesCompetencia = l.MesCompetencia,
        CreatedByUserId = l.CreatedByUserId,
        VisivelCliente = l.VisivelCliente,
        CreatedAt = l.CreatedAt,
        Anexos = _anexos.Where(a => a.LancamentoId == l.Id).ToList()
    };
}
