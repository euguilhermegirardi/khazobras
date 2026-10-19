using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IProjetoDocumentoRepository
{
    Task<ProjetoDocumento> CreateAsync(ProjetoDocumento documento);
    Task<Guid?> GetObraIdByIdAsync(Guid id);
    Task<ProjetoDocumento?> GetByIdAndObraAsync(Guid id, Guid obraId);
    Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId);
}
