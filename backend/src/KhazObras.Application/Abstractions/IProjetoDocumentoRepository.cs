using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IProjetoDocumentoRepository
{
    Task<ProjetoDocumento> CreateAsync(ProjetoDocumento documento);
    Task<ProjetoDocumento?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId);
}