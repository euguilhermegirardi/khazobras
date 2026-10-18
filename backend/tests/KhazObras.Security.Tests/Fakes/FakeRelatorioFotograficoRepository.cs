using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeRelatorioFotograficoRepository : IRelatorioFotograficoRepository
{
    private readonly List<RelatorioFotografico> _relatorios = [];

    public Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio)
    {
        _relatorios.Add(relatorio);
        return Task.FromResult(relatorio);
    }

    public Task<RelatorioFotografico?> GetByIdAsync(Guid id)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id);
        return Task.FromResult(relatorio);
    }

    public Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId)
    {
        var relatorios = _relatorios
            .Where(r => r.ObraId == obraId)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<RelatorioFotografico>>(relatorios);
    }

    public Task<Foto> AddFotoAsync(Foto foto)
    {
        _relatorios.First(r => r.Id == foto.RelatorioFotograficoId).Fotos.Add(foto);
        return Task.FromResult(foto);
    }

    public Task<Foto?> GetFotoByIdAsync(Guid id)
    {
        var foto = _relatorios.SelectMany(r => r.Fotos).FirstOrDefault(f => f.Id == id);
        return Task.FromResult(foto);
    }
}
