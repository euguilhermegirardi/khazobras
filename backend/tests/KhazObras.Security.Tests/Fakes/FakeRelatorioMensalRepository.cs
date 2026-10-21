using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

/// <summary>
/// Espelha o SQL real: acesso por id preso a obra, escrita so em rascunho (status draft), UNIQUE (obra_id, competencia).
/// Nao checa se a obra existe (isso e do service, via IObraRepository).
/// </summary>
public sealed class FakeRelatorioMensalRepository : IRelatorioMensalRepository
{
    private readonly List<RelatorioMensal> _relatorios = [];

    public IReadOnlyList<RelatorioMensal> Todos => _relatorios;

    public Task<RelatorioMensalWriteResult> TryCreateAsync(RelatorioMensal relatorio)
    {
        if (_relatorios.Any(r => r.ObraId == relatorio.ObraId && r.Competencia == relatorio.Competencia))
        {
            return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.CompetenciaDuplicada, null));
        }

        _relatorios.Add(relatorio);
        return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Ok, relatorio));
    }

    /// <summary>Atalho para montar cenarios (sem as regras de TryCreateAsync).</summary>
    public Task<RelatorioMensal> CreateAsync(RelatorioMensal relatorio)
    {
        _relatorios.Add(relatorio);
        return Task.FromResult(relatorio);
    }

    public Task<Guid?> GetObraIdByIdAsync(Guid id) =>
        Task.FromResult<Guid?>(_relatorios.FirstOrDefault(r => r.Id == id)?.ObraId);

    public Task<RelatorioMensal?> GetByIdAndObraAsync(Guid id, Guid obraId) =>
        Task.FromResult(_relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId));

    public Task<RelatorioMensal?> GetPublishedByIdAndObraAsync(Guid id, Guid obraId) =>
        Task.FromResult(_relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId && r.Status == "published"));

    public Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId)
    {
        var relatorios = _relatorios
            .Where(r => r.ObraId == obraId)
            .OrderByDescending(r => r.Competencia)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<RelatorioMensal>>(relatorios);
    }

    public Task<IReadOnlyList<RelatorioMensal>> GetPublishedByObraIdAsync(Guid obraId)
    {
        var relatorios = _relatorios
            .Where(r => r.ObraId == obraId && r.Status == "published")
            .OrderByDescending(r => r.Competencia)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<RelatorioMensal>>(relatorios);
    }

    public Task<RelatorioMensalWriteResult> UpdateDraftAsync(Guid id, Guid obraId, DateOnly competencia, string conteudo, DateTime updatedAt)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId);
        if (relatorio is null)
        {
            return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.NaoEncontrado, null));
        }

        if (relatorio.Status != "draft")
        {
            return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Conflito, null));
        }

        if (_relatorios.Any(r => r.Id != id && r.ObraId == obraId && r.Competencia == competencia))
        {
            return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.CompetenciaDuplicada, null));
        }

        relatorio.Competencia = competencia;
        relatorio.Conteudo = conteudo;
        relatorio.UpdatedAt = updatedAt;
        return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Ok, relatorio));
    }

    public Task<RelatorioMensalWriteResult> PublishAsync(Guid id, Guid obraId, DateTime publishedAt)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId);
        if (relatorio is null)
        {
            return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.NaoEncontrado, null));
        }

        if (relatorio.Status != "draft")
        {
            return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Conflito, null));
        }

        relatorio.Status = "published";
        relatorio.PublishedAt = publishedAt;
        relatorio.UpdatedAt = publishedAt;
        return Task.FromResult(new RelatorioMensalWriteResult(RelatorioMensalWriteStatus.Ok, relatorio));
    }

    public Task<RelatorioMensalWriteStatus> DeleteDraftAsync(Guid id, Guid obraId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId);
        if (relatorio is null)
        {
            return Task.FromResult(RelatorioMensalWriteStatus.NaoEncontrado);
        }

        if (relatorio.Status != "draft")
        {
            return Task.FromResult(RelatorioMensalWriteStatus.Conflito);
        }

        _relatorios.Remove(relatorio);
        return Task.FromResult(RelatorioMensalWriteStatus.Ok);
    }
}
