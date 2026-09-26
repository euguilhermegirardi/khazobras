using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IPipelineRepository
{
    Task<Pipeline> CreateAsync(Pipeline pipeline);
    Task<Pipeline?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<Pipeline>> GetAllAsync();
}