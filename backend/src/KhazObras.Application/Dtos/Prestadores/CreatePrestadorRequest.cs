namespace KhazObras.Application.Dtos.Prestadores;

public sealed record CreatePrestadorRequest(Guid ObraId, string Nome, string? Funcao, decimal? ValorContrato);