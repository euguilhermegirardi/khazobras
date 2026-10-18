using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IRelatorioMensalRepository
{
    Task<RelatorioMensal> CreateAsync(RelatorioMensal relatorio);
    Task<RelatorioMensal?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId);

    /// <summary>Visão cliente: filtra status published no SQL (defense in depth).</summary>
    Task<RelatorioMensal?> GetPublishedByIdAsync(Guid id);

    /// <summary>Visão cliente: só publicados da obra, filtrados no SQL.</summary>
    Task<IReadOnlyList<RelatorioMensal>> GetPublishedByObraIdAsync(Guid obraId);
    Task PublishAsync(Guid id, DateTime publishedAt);
}