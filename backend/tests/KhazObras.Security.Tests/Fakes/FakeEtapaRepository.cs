using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeEtapaRepository : IEtapaRepository
{
    private readonly List<Etapa> _etapas = [];

    public Task<Etapa> CreateAsync(Etapa etapa)
    {
        _etapas.Add(etapa);
        return Task.FromResult(etapa);
    }

    public Task<Etapa?> GetByIdAsync(Guid id)
    {
        var etapa = _etapas.FirstOrDefault(e => e.Id == id);
        return Task.FromResult(etapa);
    }

    public Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        var etapa = _etapas.FirstOrDefault(e => e.Id == id);
        return Task.FromResult<Guid?>(etapa?.ObraId);
    }

    public Task<Etapa?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var etapa = _etapas.FirstOrDefault(e => e.Id == id && e.ObraId == obraId);
        return Task.FromResult(etapa);
    }

    public Task<IReadOnlyList<Etapa>> GetByObraIdAsync(Guid obraId)
    {
        var etapas = _etapas
            .Where(e => e.ObraId == obraId)
            .OrderBy(e => e.Ordem)
            .ThenBy(e => e.DataInicioPrevista ?? DateOnly.MaxValue)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<Etapa>>(etapas);
    }
}
