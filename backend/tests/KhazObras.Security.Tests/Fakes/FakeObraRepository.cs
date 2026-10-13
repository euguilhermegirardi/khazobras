using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeObraRepository : IObraRepository
{
    private readonly List<Obra> _obras = [];

    public Task<Obra> CreateAsync(Obra obra)
    {
        _obras.Add(obra);
        return Task.FromResult(obra);
    }

    public Task<Obra?> GetByIdAsync(Guid id)
    {
        var obra = _obras.FirstOrDefault(o => o.Id == id);
        return Task.FromResult(obra);
    }

    public Task<(IReadOnlyList<Obra> Items, int TotalItems)> GetPagedAsync(int pageIndex, int pageSize)
    {
        var totalItems = _obras.Count;
        var items = _obras
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToList()
            .AsReadOnly();

        return Task.FromResult(new(Items: items, TotalItems: totalItems));
    }
}
