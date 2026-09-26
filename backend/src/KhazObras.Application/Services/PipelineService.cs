using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Pipelines;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class PipelineService
{
    private readonly IPipelineRepository _repository;

    public PipelineService(IPipelineRepository repository) => _repository = repository;

    public async Task<PipelineResponse> CreateAsync(CreatePipelineRequest request)
    {
        var pipeline = new Pipeline
        {
            Id = Guid.NewGuid(),
            NomeClientePotencial = request.NomeClientePotencial,
            ValorEstimado = request.ValorEstimado,
            Probabilidade = request.Probabilidade,
            EtapaFunil = request.EtapaFunil,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(pipeline);
        return ToResponse(created);
    }

    public async Task<IReadOnlyList<PipelineResponse>> GetAllAsync()
    {
        var pipelines = await _repository.GetAllAsync();
        return pipelines.Select(ToResponse).ToList();
    }

    private static PipelineResponse ToResponse(Pipeline p) => new(p.Id, p.NomeClientePotencial, p.ValorEstimado, p.Probabilidade, p.EtapaFunil, p.CreatedAt);
}