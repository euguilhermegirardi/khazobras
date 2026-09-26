using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IPrestadorRepository
{
    Task<Prestador> CreateAsync(Prestador prestador);
    Task<Prestador?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Prestador>> GetByObraIdAsync(Guid obraId);
}