namespace KhazObras.Application.Dtos.Pipelines;

public sealed record PipelineResponse(Guid Id, string NomeClientePotencial, decimal? ValorEstimado, decimal? Probabilidade, string EtapaFunil, DateTime CreatedAt);