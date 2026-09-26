using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IRelatorioMensalRepository
{
    Task<RelatorioMensal> CreateAsync(RelatorioMensal relatorio);
    Task<RelatorioMensal?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId);
    Task PublishAsync(Guid id, DateTime publishedAt);
}