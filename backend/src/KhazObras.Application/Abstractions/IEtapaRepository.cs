using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IEtapaRepository
{
    Task<Etapa> CreateAsync(Etapa etapa);
    Task<Etapa?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Etapa>> GetByObraIdAsync(Guid obraId);
}