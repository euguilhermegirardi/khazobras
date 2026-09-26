namespace KhazObras.Application.Dtos.Prestadores;

public sealed record PrestadorResponse(Guid Id, Guid ObraId, string Nome, string? Funcao, decimal? ValorContrato, DateTime CreatedAt);