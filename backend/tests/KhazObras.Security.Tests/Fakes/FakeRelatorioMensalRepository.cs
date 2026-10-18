using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeRelatorioMensalRepository : IRelatorioMensalRepository
{
    private readonly List<RelatorioMensal> _relatorios = [];

    public Task<RelatorioMensal> CreateAsync(RelatorioMensal relatorio)
    {
        _relatorios.Add(relatorio);
        return Task.FromResult(relatorio);
    }

    public Task<RelatorioMensal?> GetByIdAsync(Guid id)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id);
        return Task.FromResult(relatorio);
    }

    public Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId)
    {
        var relatorios = _relatorios
            .Where(r => r.ObraId == obraId)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<RelatorioMensal>>(relatorios);
    }

    public Task<RelatorioMensal?> GetPublishedByIdAsync(Guid id)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id && r.Status == "published");
        return Task.FromResult(relatorio);
    }

    public Task<IReadOnlyList<RelatorioMensal>> GetPublishedByObraIdAsync(Guid obraId)
    {
        var relatorios = _relatorios
            .Where(r => r.ObraId == obraId && r.Status == "published")
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<RelatorioMensal>>(relatorios);
    }

    public Task PublishAsync(Guid id, DateTime publishedAt)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id);
        if (relatorio != null)
        {
            relatorio.Status = "published";
            relatorio.PublishedAt = publishedAt;
            relatorio.UpdatedAt = DateTime.UtcNow;
        }

        return Task.CompletedTask;
    }
}
