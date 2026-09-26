using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IFornecedorRepository
{
    Task<Fornecedor> CreateAsync(Fornecedor fornecedor);
    Task<Fornecedor?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Fornecedor>> GetAllAsync();
}