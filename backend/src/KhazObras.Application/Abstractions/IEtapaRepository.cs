using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IEtapaRepository
{
    Task<Etapa> CreateAsync(Etapa etapa);
    Task<Guid?> GetObraIdByIdAsync(Guid id);
    Task<Etapa?> GetByIdAndObraAsync(Guid id, Guid obraId);
    Task<IReadOnlyList<Etapa>> GetByObraIdAsync(Guid obraId);

    /// <summary>Atualiza a etapa presa a obra (WHERE id AND obra_id). Devolve false se nenhuma linha foi afetada.</summary>
    Task<bool> UpdateAsync(Etapa etapa);
}
