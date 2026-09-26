using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class RelatorioMensalService
{
    private readonly IRelatorioMensalRepository _repository;

    public RelatorioMensalService(IRelatorioMensalRepository repository)
    {
        _repository = repository;
    }

    public async Task<RelatorioMensalResponse> CreateAsync(CreateRelatorioMensalRequest request, Guid createdByUserId)
    {
        var relatorio = new RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Competencia = request.Competencia,
            Conteudo = request.Conteudo,
            Status = "draft",
            CreatedByUserId = createdByUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(relatorio);
        return ToResponse(created);
    }

    public async Task<RelatorioMensalResponse?> GetByIdAsync(Guid id)
    {
        var relatorio = await _repository.GetByIdAsync(id);
        return relatorio is null ? null : ToResponse(relatorio);
    }

    public async Task<IReadOnlyList<RelatorioMensalResponse>> GetByObraIdAsync(Guid obraId, bool onlyPublished)
    {
        var relatorios = await _repository.GetByObraIdAsync(obraId);
        var filtered = onlyPublished ? relatorios.Where(r => r.Status == "published") : relatorios;
        return filtered.Select(ToResponse).ToList();
    }

    public async Task<RelatorioMensalResponse> PublishAsync(Guid id)
    {
        var relatorio = await _repository.GetByIdAsync(id)
            ?? throw new InvalidOperationException("Relatorio mensal nao encontrado.");

        if (relatorio.Status == "published")
        {
            throw new InvalidOperationException("Relatorio ja esta publicado.");
        }

        var publishedAt = DateTime.UtcNow;
        await _repository.PublishAsync(id, publishedAt);

        relatorio.Status = "published";
        relatorio.PublishedAt = publishedAt;

        return ToResponse(relatorio);
    }

    private static RelatorioMensalResponse ToResponse(RelatorioMensal r) => new(
        r.Id, r.ObraId, r.Competencia, r.Conteudo, r.Status, r.PublishedAt, r.CreatedByUserId, r.CreatedAt);
}