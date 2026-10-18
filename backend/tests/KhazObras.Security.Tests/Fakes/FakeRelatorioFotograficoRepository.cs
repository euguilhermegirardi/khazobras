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

    public Task<Guid?> GetObraIdByFotoIdAsync(Guid fotoId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Fotos.Any(f => f.Id == fotoId));
        return Task.FromResult<Guid?>(relatorio?.ObraId);
    }

    public Task<Foto?> GetFotoByIdAndObraAsync(Guid fotoId, Guid obraId)
    {
        var foto = _relatorios
            .Where(r => r.ObraId == obraId)
            .SelectMany(r => r.Fotos)
            .FirstOrDefault(f => f.Id == fotoId);
        return Task.FromResult(foto);
    }
}
