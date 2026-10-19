using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IEtapaRepository
{
    Task<Etapa> CreateAsync(Etapa etapa);
    Task<Etapa?> GetByIdAsync(Guid id);
    Task<Guid?> GetObraIdByIdAsync(Guid id);
    Task<Etapa?> GetByIdAndObraAsync(Guid id, Guid obraId);
    Task<IReadOnlyList<Etapa>> GetByObraIdAsync(Guid obraId);
}