namespace KhazObras.Application.Dtos.Pipelines;

public sealed record CreatePipelineRequest(string NomeClientePotencial, decimal? ValorEstimado, decimal? Probabilidade, string EtapaFunil);