using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IObraRepository
{
    Task<Obra> CreateAsync(Obra obra);
    Task<Obra?> GetByIdAsync(Guid id);
    Task<(IReadOnlyList<Obra> Items, int TotalItems)> GetPagedAsync(int pageIndex, int pageSize);
}